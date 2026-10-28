import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { shouldPublish } from '../scripts/should-publish.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(testDirectory, '..', 'scripts', 'should-publish.mjs');
const baseManifest = { manifest_version: 3, name: 'JZB Decoder', permissions: [], version: '1.2.3' };

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function withRepository(run) {
  const localThis = { root: mkdtempSync(join(tmpdir(), 'should-publish-')) };

  try {
    git(localThis.root, 'init', '--quiet');
    git(localThis.root, 'config', 'user.email', 'test@example.com');
    git(localThis.root, 'config', 'user.name', 'Test');
    git(localThis.root, 'config', 'commit.gpgsign', 'false');
    writeFileSync(join(localThis.root, 'manifest.json'), `${JSON.stringify(baseManifest)}\n`);
    writeFileSync(join(localThis.root, 'README.md'), 'one\n');
    git(localThis.root, 'add', '.');
    git(localThis.root, 'commit', '--quiet', '-m', 'base');

    return run(localThis.root);
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

function runCli(root, extraEnv = {}) {
  const base = git(root, 'rev-parse', 'HEAD~1');
  const head = git(root, 'rev-parse', 'HEAD');

  return execFileSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, BASE_SHA: base, HEAD_SHA: head, ...extraEnv }
  });
}

describe('shouldPublish', () => {
  it('publishes when a shipped file or directory changed', () => {
    const localThis = {
      files: [['panel.js'], ['icons/icon16.png'], ['design-system/tokens.css'], ['devtools.html']]
    };

    for (const changedFiles of localThis.files) {
      expect(shouldPublish({ changedFiles, baseManifest, headManifest: baseManifest })).toBe(true);
    }
  });

  it('skips docs, tests, tooling, and version-only manifest changes', () => {
    const localThis = {
      changedFiles: ['README.md', 'CHANGELOG.md', 'package.json', 'test/jzb.test.js', 'manifest.json'],
      headManifest: { ...baseManifest, version: '1.2.4' }
    };

    expect(
      shouldPublish({
        changedFiles: localThis.changedFiles,
        baseManifest,
        headManifest: localThis.headManifest
      })
    ).toBe(false);
  });

  it('publishes when the manifest changes beyond its version', () => {
    const localThis = {
      headManifest: { ...baseManifest, permissions: ['storage'], version: '1.2.4' }
    };

    expect(
      shouldPublish({
        changedFiles: ['manifest.json'],
        baseManifest,
        headManifest: localThis.headManifest
      })
    ).toBe(true);
  });

  it('skips when the manifest is not in the changed files', () => {
    expect(shouldPublish({ changedFiles: ['README.md'], baseManifest, headManifest: baseManifest })).toBe(false);
  });
});

describe('should-publish CLI', () => {
  it('writes publish=false for a docs-only change', () => {
    const localThis = { output: undefined };

    localThis.output = withRepository((root) => {
      writeFileSync(join(root, 'README.md'), 'two\n');
      git(root, 'commit', '--quiet', '-am', 'docs');
      writeFileSync(join(root, 'out'), '');

      const stdout = runCli(root, { GITHUB_OUTPUT: join(root, 'out') });

      return { stdout, file: readFileSync(join(root, 'out'), 'utf8') };
    });

    expect(localThis.output.stdout).toContain('::notice::');
    expect(localThis.output.file).toBe('publish=false\n');
  });

  it('writes publish=true when a runtime file changed', () => {
    const localThis = { stdout: undefined };

    localThis.stdout = withRepository((root) => {
      writeFileSync(join(root, 'panel.js'), 'console.log(1);\n');
      git(root, 'add', '.');
      git(root, 'commit', '--quiet', '-m', 'runtime');

      return runCli(root);
    });

    expect(localThis.stdout).toBe('publish=true\n');
  });

  it('requires both revisions', () => {
    const localThis = { stderr: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, BASE_SHA: '', HEAD_SHA: '' }
      });
    } catch (error) {
      localThis.stderr = error.stderr.toString();
    }

    expect(localThis.stderr).toContain('BASE_SHA and HEAD_SHA are required');
  });
});
