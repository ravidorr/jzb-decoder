import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, '..');
const coverageSummaryScript = join(repositoryRoot, 'scripts', 'coverage-summary.mjs');
const preCommitHook = join(repositoryRoot, '.husky', 'pre-commit');
const prePushHook = join(repositoryRoot, '.husky', 'pre-push');

function withFixture(run) {
  const localThis = {
    root: mkdtempSync(join(tmpdir(), 'jzb-tooling-'))
  };

  try {
    return run(localThis.root);
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

function writeCommand(root, name, body) {
  const commandPath = join(root, name);
  writeFileSync(commandPath, `#!/usr/bin/env sh\n${body}\n`);
  chmodSync(commandPath, 0o755);
}

function hookEnvironment(root, values) {
  return {
    ...process.env,
    ...values,
    HOOK_LOG: join(root, 'hook.log'),
    PATH: `${root}:${process.env.PATH}`
  };
}

describe('tooling scripts', () => {
  it('prints a four-column coverage table', () => {
    const localThis = { output: '' };

    localThis.output = withFixture((root) => {
      const summaryPath = join(root, 'coverage-summary.json');
      writeFileSync(summaryPath, JSON.stringify({
        total: {
          branches: { covered: 1, pct: 100, total: 1 },
          functions: { covered: 1, pct: 100, total: 1 },
          lines: { covered: 1, pct: 100, total: 1 },
          statements: { covered: 1, pct: 100, total: 1 }
        }
      }));

      return execFileSync(process.execPath, [coverageSummaryScript, summaryPath], {
        encoding: 'utf8'
      });
    });

    expect(localThis.output).toContain('| --- | --- | --- | --- |');
  });

  it('stops the pre-commit hook when lint-staged fails', () => {
    const localThis = { result: undefined };

    localThis.result = withFixture((root) => {
      writeCommand(root, 'npx', 'printf "npx %s\\n" "$*" >> "$HOOK_LOG"\nexit "$NPX_STATUS"');
      writeCommand(root, 'npm', 'printf "npm %s\\n" "$*" >> "$HOOK_LOG"\nexit 0');

      const result = spawnSync('sh', [preCommitHook], {
        cwd: root,
        encoding: 'utf8',
        env: hookEnvironment(root, { NPX_STATUS: '1' })
      });

      return {
        log: readFileSync(join(root, 'hook.log'), 'utf8'),
        status: result.status
      };
    });

    expect(localThis.result.status).toBe(1);
    expect(localThis.result.log).not.toContain('npm run check:generated');
  });

  it('stops the pre-push hook when lint fails', () => {
    const localThis = { result: undefined };

    localThis.result = withFixture((root) => {
      writeCommand(root, 'npm', `printf "npm %s\\n" "$*" >> "$HOOK_LOG"
if [ "$1 $2" = "run lint" ]; then
  exit "$NPM_LINT_STATUS"
fi
exit 0`);
      writeCommand(root, 'node', 'printf "node %s\\n" "$*" >> "$HOOK_LOG"\nexit 0');

      const result = spawnSync('sh', [prePushHook], {
        cwd: root,
        encoding: 'utf8',
        env: hookEnvironment(root, { NPM_LINT_STATUS: '1' }),
        input: 'refs/heads/fix local-sha refs/heads/fix remote-sha\n'
      });

      return {
        log: readFileSync(join(root, 'hook.log'), 'utf8'),
        status: result.status
      };
    });

    expect(localThis.result.status).toBe(1);
    expect(localThis.result.log).not.toContain('npm run typecheck');
  });
});
