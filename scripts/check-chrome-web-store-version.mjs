import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

const apiBaseUrl = 'https://chromewebstore.googleapis.com/v2';
const defaultManifestPath = 'dist/jzb-decoder/manifest.json';

export function readStoreVersions(fetchStatus) {
  const revisions = [
    fetchStatus?.publishedItemRevisionStatus,
    fetchStatus?.submittedItemRevisionStatus
  ];
  const versions = [];

  for (const revision of revisions) {
    for (const channel of revision?.distributionChannels ?? []) {
      const version = channel?.crxVersion;

      if (semver.valid(version) && !versions.includes(version)) {
        versions.push(version);
      }
    }
  }

  return versions;
}

export function evaluateVersion(manifestVersion, fetchStatus) {
  if (!semver.valid(manifestVersion)) {
    throw new Error(`Manifest version "${manifestVersion}" is not valid SemVer.`);
  }

  const storeVersions = readStoreVersions(fetchStatus);
  const highest = storeVersions.sort(semver.rcompare)[0];

  return {
    publish: highest === undefined || semver.gt(manifestVersion, highest),
    storeVersions
  };
}

export async function fetchChromeWebStoreStatus({ accessToken, publisherId, extensionId }) {
  const response = await fetch(
    `${apiBaseUrl}/publishers/${publisherId}/items/${extensionId}:fetchStatus`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Chrome Web Store fetchStatus failed (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}

export async function runVersionCheck({
  accessToken,
  publisherId,
  extensionId,
  manifestPath = defaultManifestPath,
  githubOutput
}) {
  const manifestVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).version;
  const fetchStatus = await fetchChromeWebStoreStatus({ accessToken, publisherId, extensionId });
  const { publish, storeVersions } = evaluateVersion(manifestVersion, fetchStatus);
  const store = storeVersions.length > 0 ? storeVersions.join(', ') : 'none';

  if (publish) {
    process.stdout.write(`Publishing ${manifestVersion} (store has: ${store}).\n`);
  } else {
    process.stdout.write(
      `::notice::Skipping Chrome Web Store publish: ${manifestVersion} is not higher than the store's ${store}.\n`
    );
  }

  if (githubOutput) {
    appendFileSync(githubOutput, `publish=${publish}\n`);
  }

  return { publish, manifestVersion, storeVersions };
}

async function runCli() {
  const { ACCESS_TOKEN, PUBLISHER_ID, EXTENSION_ID, MANIFEST_PATH, GITHUB_OUTPUT } = process.env;

  if (!ACCESS_TOKEN || !PUBLISHER_ID || !EXTENSION_ID) {
    throw new Error('ACCESS_TOKEN, PUBLISHER_ID, and EXTENSION_ID are required');
  }

  await runVersionCheck({
    accessToken: ACCESS_TOKEN,
    publisherId: PUBLISHER_ID,
    extensionId: EXTENSION_ID,
    manifestPath: MANIFEST_PATH,
    githubOutput: GITHUB_OUTPUT
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
