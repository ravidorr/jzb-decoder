import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Keep in sync with the files scripts/package.sh copies into the extension zip.
const shippedFiles = new Set([
  'jzb.js',
  'panel.js',
  'panel.html',
  'panel.css',
  'devtools.js',
  'devtools.html'
]);
const shippedDirectories = ['icons/', 'design-system/'];

function withoutVersion(manifest) {
  const rest = { ...manifest };

  delete rest.version;

  return rest;
}

export function shouldPublish({ changedFiles, baseManifest, headManifest }) {
  const shipsFiles = changedFiles.some(
    (file) => shippedFiles.has(file) || shippedDirectories.some((directory) => file.startsWith(directory))
  );

  if (shipsFiles) {
    return true;
  }

  return changedFiles.includes('manifest.json') &&
    !isDeepStrictEqual(withoutVersion(baseManifest), withoutVersion(headManifest));
}

function gitOutput(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function runCli() {
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;

  if (!baseSha || !headSha) {
    throw new Error('BASE_SHA and HEAD_SHA are required');
  }

  const changedFiles = gitOutput(['diff', '--name-only', baseSha, headSha])
    .trim()
    .split('\n')
    .filter(Boolean);
  const result = shouldPublish({
    changedFiles,
    baseManifest: JSON.parse(gitOutput(['show', `${baseSha}:manifest.json`])),
    headManifest: JSON.parse(gitOutput(['show', `${headSha}:manifest.json`]))
  });

  if (!result) {
    process.stdout.write('::notice::No shipped extension files changed; skipping Chrome Web Store publish.\n');
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `publish=${result}\n`);
  }

  process.stdout.write(`publish=${result}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
