import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

export function extractChangelogNotes(changelog, version) {
  const header = `## [${version}]`;
  const lines = changelog.split('\n');
  const notes = [];
  let collecting = false;

  for (const line of lines) {
    if (line.startsWith('## [')) {
      if (collecting) {
        break;
      }

      collecting = line.startsWith(header);
      continue;
    }

    if (collecting) {
      notes.push(line);
    }
  }

  return notes.join('\n');
}

export function validateRelease(baseVersion, currentVersion, changelog) {
  if (baseVersion === currentVersion) {
    throw new Error('package version must change');
  }

  if (semver.compare(currentVersion, baseVersion) <= 0) {
    throw new Error('package version must increase');
  }

  const notes = extractChangelogNotes(changelog, currentVersion);

  if (!notes.trim()) {
    throw new Error(
      `CHANGELOG.md must contain a non-empty section for ${currentVersion}`
    );
  }
}

export function validateTaggedRelease({ tagName, packageVersion, changelog, releaseNotes }) {
  const tagVersion = tagName.startsWith('v') ? tagName.slice(1) : tagName;

  if (tagVersion !== packageVersion) {
    throw new Error(`tag ${tagVersion} does not match package.json version ${packageVersion}`);
  }

  if (!extractChangelogNotes(changelog, packageVersion).trim()) {
    throw new Error(
      `CHANGELOG.md must contain a non-empty section for ${packageVersion}`
    );
  }

  if (!releaseNotes.trim()) {
    throw new Error('release notes must not be empty');
  }
}

function runReleaseGate(baseRef) {
  if (!baseRef) {
    throw new Error('BASE_REF is required');
  }

  if (/^0+$/.test(baseRef)) {
    return;
  }

  const mergeBase = execFileSync(
    'git',
    ['merge-base', baseRef, 'HEAD'],
    { encoding: 'utf8' }
  ).trim();
  const basePackage = JSON.parse(
    execFileSync('git', ['show', `${mergeBase}:package.json`], { encoding: 'utf8' })
  );
  const currentPackage = JSON.parse(readFileSync('package.json', 'utf8'));

  validateRelease(
    basePackage.version,
    currentPackage.version,
    readFileSync('CHANGELOG.md', 'utf8')
  );
}

function main() {
  const extractIndex = process.argv.indexOf('--extract-release-notes');

  if (extractIndex !== -1) {
    const version = process.argv[extractIndex + 1];

    if (!version) {
      throw new Error('release version is required');
    }

    writeFileSync(
      'release-notes.md',
      `${extractChangelogNotes(readFileSync('CHANGELOG.md', 'utf8'), version).trimEnd()}\n`
    );
    return;
  }

  const tagIndex = process.argv.indexOf('--tag');

  if (tagIndex !== -1) {
    const tagName = process.argv[tagIndex + 1];

    if (!tagName) {
      throw new Error('tag name is required');
    }

    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    validateTaggedRelease({
      tagName,
      packageVersion: packageJson.version,
      changelog: readFileSync('CHANGELOG.md', 'utf8'),
      releaseNotes: readFileSync('release-notes.md', 'utf8')
    });
    return;
  }

  runReleaseGate(process.env.BASE_REF);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
