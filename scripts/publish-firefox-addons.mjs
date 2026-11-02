import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

import { extractChangelogNotes } from './check-release.mjs';
import { missingVariables, parseJsonBody, reportFatalError, storeFetch } from './store-request.mjs';

const apiBaseUrl = 'https://addons.mozilla.org/api/v5/addons';
const defaultManifestPath = 'dist/jzb-decoder/manifest.json';
const defaultPackagePath = 'dist/jzb-decoder.zip';
const defaultChangelogPath = 'CHANGELOG.md';
const pollIntervalMs = 5000;
const pollAttempts = 60;

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

export function createJwt({ issuer, secret, now = Date.now() }) {
  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: issuer,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + 60
  }));
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

  return `${header}.${payload}.${signature}`;
}

async function amoRequest(url, { credentials, ...options }) {
  if (!url.startsWith(`${apiBaseUrl}/`)) {
    throw new Error(`Refusing to send AMO credentials to unexpected URL ${url}`);
  }

  const { body } = await storeFetch('AMO', url, {
    ...options,
    headers: { ...options.headers, Authorization: `JWT ${createJwt(credentials)}` }
  });

  return parseJsonBody('AMO', url, body);
}

export function evaluateVersion(manifestVersion, storeVersions) {
  if (!semver.valid(manifestVersion)) {
    throw new Error(`Manifest version "${manifestVersion}" is not valid SemVer.`);
  }

  const validVersions = storeVersions.filter((version) => semver.valid(version)).sort(semver.rcompare);
  const ignoredVersions = storeVersions.filter((version) => !semver.valid(version));

  return {
    publish: validVersions.length === 0 || semver.gt(manifestVersion, validVersions[0]),
    storeVersions: validVersions,
    ignoredVersions
  };
}

// Lists every version AMO knows about, including ones awaiting review, rejected, or unlisted.
export async function fetchAmoVersions({ credentials, addonId }) {
  const versions = [];
  let url = `${apiBaseUrl}/addon/${encodeURIComponent(addonId)}/versions/?filter=all_with_unlisted&page_size=50`;

  while (url) {
    const page = await amoRequest(url, { credentials });

    if (!Array.isArray(page.results)) {
      throw new Error(`AMO versions response has no results list: ${JSON.stringify(page)}`);
    }

    versions.push(...page.results.map((entry) => entry.version));
    url = page.next;
  }

  return versions;
}

async function waitForUpload({ credentials, uuid, sleep }) {
  let upload;

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    upload = await amoRequest(`${apiBaseUrl}/upload/${uuid}/`, { credentials });

    if (upload.processed) {
      if (!upload.valid) {
        throw new Error(`AMO rejected the upload: ${JSON.stringify(upload.validation)}`);
      }

      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `AMO did not finish processing upload ${uuid} within ${(pollIntervalMs * pollAttempts) / 60000} minutes: ${JSON.stringify(upload)}`
  );
}

export async function submitVersion({ credentials, addonId, packagePath, releaseNotes, sleep }) {
  const form = new FormData();

  form.append('channel', 'listed');
  form.append('upload', new Blob([readFileSync(packagePath)], { type: 'application/zip' }), 'jzb-decoder.zip');

  const upload = await amoRequest(`${apiBaseUrl}/upload/`, { credentials, method: 'POST', body: form });

  if (!upload.uuid) {
    throw new Error(`AMO upload response has no uuid: ${JSON.stringify(upload)}`);
  }

  await waitForUpload({ credentials, uuid: upload.uuid, sleep });

  return amoRequest(`${apiBaseUrl}/addon/${encodeURIComponent(addonId)}/versions/`, {
    credentials,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload: upload.uuid, release_notes: { 'en-US': releaseNotes } })
  });
}

export async function runPublish({
  credentials,
  addonId,
  manifestPath = defaultManifestPath,
  packagePath = defaultPackagePath,
  changelogPath = defaultChangelogPath,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}) {
  const manifestVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).version;
  const { publish, storeVersions, ignoredVersions } = evaluateVersion(
    manifestVersion,
    await fetchAmoVersions({ credentials, addonId })
  );
  const store = storeVersions.length > 0 ? storeVersions.join(', ') : 'none';

  if (ignoredVersions.length > 0) {
    process.stdout.write(
      `::warning::Ignoring AMO versions that are not valid SemVer: ${ignoredVersions.join(', ')}.\n`
    );
  }

  if (!publish) {
    // A store version below the manifest's cannot happen here; a higher one means AMO is ahead of this repository.
    const level = storeVersions[0] === manifestVersion ? 'notice' : 'warning';

    process.stdout.write(
      `::${level}::Skipping Firefox Add-ons publish: ${manifestVersion} is not higher than AMO's highest version ${storeVersions[0]}.\n`
    );

    return { published: false, manifestVersion, storeVersions };
  }

  const releaseNotes = extractChangelogNotes(readFileSync(changelogPath, 'utf8'), manifestVersion).trim();

  if (!releaseNotes) {
    throw new Error(`${changelogPath} has no notes for ${manifestVersion}; refusing to submit to AMO.`);
  }

  process.stdout.write(`Publishing ${manifestVersion} to Firefox Add-ons (AMO has: ${store}).\n`);

  const version = await submitVersion({ credentials, addonId, packagePath, releaseNotes, sleep });

  process.stdout.write(`Submitted version ${version.version} to AMO for review.\n`);

  return { published: true, manifestVersion, storeVersions };
}

export async function runCli() {
  const { AMO_JWT_ISSUER, AMO_JWT_SECRET, ADDON_ID, MANIFEST_PATH, PACKAGE_PATH } = process.env;
  const missing = missingVariables(['AMO_JWT_ISSUER', 'AMO_JWT_SECRET', 'ADDON_ID']);

  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`);
  }

  await runPublish({
    credentials: { issuer: AMO_JWT_ISSUER, secret: AMO_JWT_SECRET },
    addonId: ADDON_ID,
    manifestPath: MANIFEST_PATH || undefined,
    packagePath: PACKAGE_PATH || undefined
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch(reportFatalError);
}
