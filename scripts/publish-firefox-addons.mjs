import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

import { extractChangelogNotes } from './check-release.mjs';

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
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `JWT ${createJwt(credentials)}` }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`AMO request ${options.method ?? 'GET'} ${url} failed (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}

export function evaluateVersion(manifestVersion, storeVersions) {
  if (!semver.valid(manifestVersion)) {
    throw new Error(`Manifest version "${manifestVersion}" is not valid SemVer.`);
  }

  const validVersions = storeVersions.filter((version) => semver.valid(version)).sort(semver.rcompare);

  return {
    publish: validVersions.length === 0 || semver.gt(manifestVersion, validVersions[0]),
    storeVersions: validVersions
  };
}

// Lists every version AMO knows about, including ones awaiting review, rejected, or unlisted.
export async function fetchAmoVersions({ credentials, addonId }) {
  const versions = [];
  let url = `${apiBaseUrl}/addon/${encodeURIComponent(addonId)}/versions/?filter=all_with_unlisted&page_size=50`;

  while (url) {
    const page = await amoRequest(url, { credentials });

    versions.push(...page.results.map((entry) => entry.version));
    url = page.next;
  }

  return versions;
}

async function waitForUpload({ credentials, uuid, sleep }) {
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const upload = await amoRequest(`${apiBaseUrl}/upload/${uuid}/`, { credentials });

    if (upload.processed) {
      if (!upload.valid) {
        throw new Error(`AMO rejected the upload: ${JSON.stringify(upload.validation)}`);
      }

      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error('AMO did not finish processing the upload within five minutes.');
}

export async function submitVersion({ credentials, addonId, packagePath, releaseNotes, sleep }) {
  const form = new FormData();

  form.append('channel', 'listed');
  form.append('upload', new Blob([readFileSync(packagePath)], { type: 'application/zip' }), 'jzb-decoder.zip');

  const upload = await amoRequest(`${apiBaseUrl}/upload/`, { credentials, method: 'POST', body: form });

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
  const { publish, storeVersions } = evaluateVersion(
    manifestVersion,
    await fetchAmoVersions({ credentials, addonId })
  );
  const store = storeVersions.length > 0 ? storeVersions.join(', ') : 'none';

  if (!publish) {
    process.stdout.write(
      `::notice::Skipping Firefox Add-ons publish: ${manifestVersion} is not higher than AMO's ${store}.\n`
    );

    return { published: false, manifestVersion, storeVersions };
  }

  const releaseNotes = extractChangelogNotes(readFileSync(changelogPath, 'utf8'), manifestVersion).trim();

  process.stdout.write(`Publishing ${manifestVersion} to Firefox Add-ons (AMO has: ${store}).\n`);

  const version = await submitVersion({ credentials, addonId, packagePath, releaseNotes, sleep });

  process.stdout.write(`Submitted version ${version.version} to AMO for review.\n`);

  return { published: true, manifestVersion, storeVersions };
}

async function runCli() {
  const { AMO_JWT_ISSUER, AMO_JWT_SECRET, ADDON_ID, MANIFEST_PATH } = process.env;

  if (!AMO_JWT_ISSUER || !AMO_JWT_SECRET || !ADDON_ID) {
    throw new Error('AMO_JWT_ISSUER, AMO_JWT_SECRET, and ADDON_ID are required');
  }

  await runPublish({
    credentials: { issuer: AMO_JWT_ISSUER, secret: AMO_JWT_SECRET },
    addonId: ADDON_ID,
    manifestPath: MANIFEST_PATH
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
