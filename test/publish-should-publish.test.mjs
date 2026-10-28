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

// Git hooks export GIT_DIR and related variables. Without removing them, the git commands below would act
// on the repository running the hook instead of the temporary one.
function isolatedEnvironment(values = {}) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
  );

  return { ...environment, ...values };
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: isolatedEnvironment() }).trim();
}

function commitFile(root, file, content, message) {
  writeFileSync(join(root, file), content);
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', message);
}

// Builds a repository whose main branch holds the base commit, then lets the test simulate pull requests.
function withRepository(run) {
  const localThis = { root: mkdtempSync(join(tmpdir(), 'should-publish-')) };

  try {
    git(localThis.root, 'init', '--quiet');
    git(localThis.root, 'config', 'user.email', 'test@example.com');
    git(localThis.root, 'config', 'user.name', 'Test');
    git(localThis.root, 'config', 'commit.gpgsign', 'false');
    git(localThis.root, 'branch', '-M', 'main');
    writeFileSync(join(localThis.root, 'manifest.json'), `${JSON.stringify(baseManifest)}\n`);
    writeFileSync(join(localThis.root, 'README.md'), 'one\n');
    writeFileSync(join(localThis.root, 'panel.js'), 'v1\n');
    git(localThis.root, 'add', '.');
    git(localThis.root, 'commit', '--quiet', '-m', 'base');

    return run(localThis.root);
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

// Commits a change on a pull request branch, then squash-merges the same change onto main.
function mergePullRequest(root, file, content, { branchFrom = 'main' } = {}) {
  git(root, 'checkout', '--quiet', '-b', 'pr', branchFrom);
  commitFile(root, file, content, 'pull request');
  const headSha = git(root, 'rev-parse', 'HEAD');

  git(root, 'checkout', '--quiet', 'main');
  commitFile(root, file, content, 'squash merge');

  return { headSha, mergeSha: git(root, 'rev-parse', 'HEAD') };
}

function runCli(root, { mergeSha, headSha }, extraEnv = {}) {
  return execFileSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: isolatedEnvironment({ MERGE_SHA: mergeSha, HEAD_SHA: headSha, ...extraEnv })
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
      const merged = mergePullRequest(root, 'README.md', 'two\n');
      writeFileSync(join(root, 'out'), '');

      const stdout = runCli(root, merged, { GITHUB_OUTPUT: join(root, 'out') });

      return { stdout, file: readFileSync(join(root, 'out'), 'utf8') };
    });

    expect(localThis.output.stdout).toContain('::notice::');
    expect(localThis.output.file).toBe('publish=false\n');
  });

  it('writes publish=true when a runtime file changed', () => {
    const localThis = { stdout: undefined };

    localThis.stdout = withRepository((root) => runCli(root, mergePullRequest(root, 'panel.js', 'v2\n')));

    expect(localThis.stdout).toBe('publish=true\n');
  });

  it('ignores runtime changes merged to main after the pull request branched', () => {
    const localThis = { stdout: undefined };

    localThis.stdout = withRepository((root) => {
      git(root, 'checkout', '--quiet', '-b', 'pr');
      commitFile(root, 'README.md', 'two\n', 'pull request');
      const headSha = git(root, 'rev-parse', 'HEAD');

      git(root, 'checkout', '--quiet', 'main');
      commitFile(root, 'panel.js', 'v2\n', 'unrelated runtime merge');
      commitFile(root, 'README.md', 'two\n', 'squash merge');

      return runCli(root, { headSha, mergeSha: git(root, 'rev-parse', 'HEAD') });
    });

    expect(localThis.stdout).toContain('publish=false\n');
  });

  it('publishes a pull request that reverts a shipped file to its older state', () => {
    const localThis = { stdout: undefined };

    localThis.stdout = withRepository((root) => {
      commitFile(root, 'panel.js', 'v2\n', 'runtime change');

      return runCli(root, mergePullRequest(root, 'panel.js', 'v1\n'));
    });

    expect(localThis.stdout).toBe('publish=true\n');
  });

  it('requires both revisions', () => {
    const localThis = { stderr: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: isolatedEnvironment({ MERGE_SHA: '', HEAD_SHA: '' })
      });
    } catch (error) {
      localThis.stderr = error.stderr.toString();
    }

    expect(localThis.stderr).toContain('MERGE_SHA and HEAD_SHA are required');
  });
});
