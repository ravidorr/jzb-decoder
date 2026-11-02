import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { missingVariables, parseJsonBody, reportFatalError, storeFetch } from './store-request.mjs';

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

function edgeRequest(url, { credentials, headers, ...options }) {
  return storeFetch('Edge Add-ons', url, {
    ...options,
    headers: { ...authHeaders(credentials), ...headers }
  });
}

function operationIdFrom(response) {
  const location = response.headers.get('Location');

  if (!location) {
    throw new Error('Edge Add-ons did not return an operation ID in the Location header.');
  }

  const operationId = location.split('/').filter(Boolean).pop();

  if (!operationId) {
    throw new Error(`Edge Add-ons returned an unusable Location header: ${location}`);
  }

  return operationId;
}

async function waitForOperation({ url, credentials, sleep }) {
  let operation;

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const { body } = await edgeRequest(url, { credentials });

    operation = parseJsonBody('Edge Add-ons', url, body);

    if (operation.status !== 'InProgress') {
      return operation;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Edge Add-ons operation ${url} did not finish within ${(pollIntervalMs * pollAttempts) / 60000} minutes: ${JSON.stringify(operation)}`
  );
}

export async function uploadPackage({ credentials, productId, packagePath, sleep }) {
  const base = `${apiBaseUrl}/${productId}/submissions/draft/package`;
  const { response } = await edgeRequest(base, {
    credentials,
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: readFileSync(packagePath)
  });

  return waitForOperation({
    url: `${base}/operations/${operationIdFrom(response)}`,
    credentials,
    sleep
  });
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

  // The Publish API cannot read the store version, so the store decides: it answers the upload or
  // publish call with InProgressSubmission or NoModulesUpdated when there is nothing to submit.
  const upload = await uploadPackage({ credentials, productId, packagePath, sleep });

  if (upload.status !== 'Succeeded') {
    return finish(upload, manifestVersion, 'package upload');
  }

  const operation = await publishDraft({
    credentials,
    productId,
    notes: `Automated release of version ${manifestVersion} from GitHub Actions.`,
    sleep
  });

  return finish(operation, manifestVersion, 'publish');
}

function finish(operation, manifestVersion, step) {
  if (operation.status === 'Succeeded' && step === 'publish') {
    process.stdout.write(`Submitted version ${manifestVersion} to Microsoft Edge Add-ons: ${operation.message ?? 'no message'}\n`);

    return { published: true, manifestVersion };
  }

  const reason = skippableErrorCodes.get(operation.errorCode);

  if (reason) {
    process.stdout.write(
      `::warning::Microsoft Edge Add-ons did not receive ${manifestVersion}: ${reason}. The next release that changes the extension submits the then-current version.\n`
    );

    return { published: false, manifestVersion };
  }

  throw new Error(`Edge Add-ons ${step} failed: ${JSON.stringify(operation)}`);
}

export async function runCli() {
  const { EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID, MANIFEST_PATH, PACKAGE_PATH } = process.env;
  const missing = missingVariables(['EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID']);

  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`);
  }

  await runPublish({
    credentials: { clientId: EDGE_CLIENT_ID, apiKey: EDGE_API_KEY },
    productId: EDGE_PRODUCT_ID,
    manifestPath: MANIFEST_PATH || undefined,
    packagePath: PACKAGE_PATH || undefined
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch(reportFatalError);
}
