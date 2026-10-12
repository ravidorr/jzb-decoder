import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(testDirectory, '..', 'scripts', 'check-release.mjs');

function withFixture(run) {
  const localThis = {
    root: mkdtempSync('/tmp/check-release-')
  };

  try {
    return run(localThis.root);
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

function writeFixture(root, releaseNotes) {
  writeFileSync(root + '/package.json', '{ "version": "1.2.3" }\n');
  writeFileSync(root + '/CHANGELOG.md', '## [1.2.3] - 2026-10-11\n\n- Baseline.\n');
  writeFileSync(root + '/release-notes.md', releaseNotes);
}

describe('check-release CLI', () => {
  it('extracts release notes', () => {
    const localThis = { notes: undefined };

    localThis.notes = withFixture((root) => {
      writeFixture(root, '');
      execFileSync(process.execPath, [scriptPath, '--extract-release-notes', '1.2.3'], {
        cwd: root
      });
      return readFileSync(root + '/release-notes.md', 'utf8');
    });

    expect(localThis.notes).toBe('\n- Baseline.\n');
  });

  it('rejects an incomplete tagged release', () => {
    const localThis = { result: undefined };

    localThis.result = withFixture((root) => {
      writeFixture(root, '');
      try {
        execFileSync(process.execPath, [scriptPath, '--tag', 'v1.2.3'], {
          cwd: root,
          stdio: 'pipe'
        });
        return '';
      } catch (error) {
        return error.stderr.toString();
      }
    });

    expect(localThis.result).toContain('release notes must not be empty');
  });

  it('uses the merge-base package metadata for a tooling-only branch', () => {
    const localThis = { result: undefined };

    localThis.result = withFixture((root) => {
      writeFileSync(
        root + '/package.json',
        '{ "name": "fixture", "version": "1.2.3", "devDependencies": {}, "overrides": { "example": "1.0.0" } }\n'
      );
      writeFileSync(root + '/CHANGELOG.md', '## [1.2.3]\n\n- Baseline.\n');
      writeFileSync(
        root + '/base-package.json',
        '{ "name": "fixture", "version": "1.2.3", "devDependencies": {} }\n'
      );
      const gitPath = root + '/git';
      writeFileSync(
        gitPath,
        `#!/usr/bin/env sh
case "$1" in
  merge-base) printf '%s\\n' base-ref ;;
  diff) printf '%s\\n' package-lock.json package.json ;;
  show) cat "$BASE_PACKAGE" ;;
  *) exit 1 ;;
esac
`
      );
      chmodSync(gitPath, 0o755);

      return execFileSync(process.execPath, [scriptPath], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          BASE_PACKAGE: root + '/base-package.json',
          BASE_REF: 'main',
          PATH: `${root}:${process.env.PATH}`
        }
      });
    });

    expect(localThis.result).toBe('');
  });
});
