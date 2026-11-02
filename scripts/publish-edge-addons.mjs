import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const apiBaseUrl = 'https://api.addons.microsoftedge.microsoft.com/v1/products';
const defaultManifestPath = 'dist/jzb-decoder/manifest.json';
const defaultPackagePath = 'dist/jzb-decoder.zip';
const pollIntervalMs = 5000;
const pollAttempts = 60;

// Publish failures that mean "nothing to do right now" rather than a broken release.
const skippableErrorCodes = new Map([
  ['InProgressSubmission', 'a submission is already in review'],
  ['NoModulesUpdated', 'the store already has this package']
]);

function authHeaders({ clientId, apiKey }) {
  return { Authorization: `ApiKey ${apiKey}`, 'X-ClientID': clientId };
}

async function edgeRequest(url, { credentials, headers, ...options }) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(credentials), ...headers }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Edge Add-ons request ${options.method ?? 'GET'} ${url} failed (${response.status}): ${body}`);
  }

  return { body, response };
}

function operationIdFrom(response) {
  const location = response.headers.get('Location');

  if (!location) {
    throw new Error('Edge Add-ons did not return an operation ID in the Location header.');
  }

  return location.split('/').pop();
}

async function waitForOperation({ url, credentials, sleep }) {
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const { body } = await edgeRequest(url, { credentials });
    const operation = JSON.parse(body);

    if (operation.status !== 'InProgress') {
      return operation;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error('Edge Add-ons did not finish the operation within five minutes.');
}

export async function uploadPackage({ credentials, productId, packagePath, sleep }) {
  const base = `${apiBaseUrl}/${productId}/submissions/draft/package`;
  const { response } = await edgeRequest(base, {
    credentials,
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: readFileSync(packagePath)
  });
  const operation = await waitForOperation({
    url: `${base}/operations/${operationIdFrom(response)}`,
    credentials,
    sleep
  });

  if (operation.status !== 'Succeeded') {
    throw new Error(`Edge Add-ons package upload failed: ${JSON.stringify(operation)}`);
  }
}

export async function publishDraft({ credentials, productId, notes, sleep }) {
  const base = `${apiBaseUrl}/${productId}/submissions`;
  const { response } = await edgeRequest(base, {
    credentials,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });

  return waitForOperation({
    url: `${base}/operations/${operationIdFrom(response)}`,
    credentials,
    sleep
  });
}

export async function runPublish({
  credentials,
  productId,
  manifestPath = defaultManifestPath,
  packagePath = defaultPackagePath,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}) {
  const manifestVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).version;

  // The Publish API cannot read the store version, so the store itself decides: it answers the
  // publish call with InProgressSubmission or NoModulesUpdated when there is nothing to submit.
  await uploadPackage({ credentials, productId, packagePath, sleep });

  const operation = await publishDraft({
    credentials,
    productId,
    notes: `Automated release of version ${manifestVersion} from GitHub Actions.`,
    sleep
  });

  if (operation.status === 'Succeeded') {
    process.stdout.write(`Submitted version ${manifestVersion} to Microsoft Edge Add-ons: ${operation.message}\n`);

    return { published: true, manifestVersion };
  }

  const reason = skippableErrorCodes.get(operation.errorCode);

  if (reason) {
    process.stdout.write(
      `::notice::Skipping Microsoft Edge Add-ons publish of ${manifestVersion}: ${reason}.\n`
    );

    return { published: false, manifestVersion };
  }

  throw new Error(`Edge Add-ons publish failed: ${JSON.stringify(operation)}`);
}

async function runCli() {
  const { EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID, MANIFEST_PATH } = process.env;

  if (!EDGE_CLIENT_ID || !EDGE_API_KEY || !EDGE_PRODUCT_ID) {
    throw new Error('EDGE_CLIENT_ID, EDGE_API_KEY, and EDGE_PRODUCT_ID are required');
  }

  await runPublish({
    credentials: { clientId: EDGE_CLIENT_ID, apiKey: EDGE_API_KEY },
    productId: EDGE_PRODUCT_ID,
    manifestPath: MANIFEST_PATH
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
