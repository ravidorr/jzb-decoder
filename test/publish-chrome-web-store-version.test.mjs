import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  evaluateVersion,
  fetchChromeWebStoreStatus,
  readStoreVersions,
  runVersionCheck
} from '../scripts/check-chrome-web-store-version.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(testDirectory, '..', 'scripts', 'check-chrome-web-store-version.mjs');
const credentials = { accessToken: 'token', publisherId: 'pub', extensionId: 'ext' };

function statusWith({ published = [], submitted = [] } = {}) {
  const channels = (versions) => ({
    distributionChannels: versions.map((crxVersion) => ({ crxVersion }))
  });

  return {
    publishedItemRevisionStatus: channels(published),
    submittedItemRevisionStatus: channels(submitted)
  };
}

function mockFetch(response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

async function withDirectory(run) {
  const localThis = { root: mkdtempSync(join(tmpdir(), 'cws-version-')) };

  try {
    return await run(localThis.root);
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readStoreVersions', () => {
  it('collects unique valid versions from published and submitted revisions', () => {
    const localThis = {
      status: statusWith({ published: ['1.2.0', '1.2.0'], submitted: ['1.2.3', 'not-semver'] })
    };

    expect(readStoreVersions(localThis.status)).toEqual(['1.2.0', '1.2.3']);
  });

  it('returns an empty list when nothing is published or submitted', () => {
    expect(readStoreVersions({})).toEqual([]);
    expect(readStoreVersions(undefined)).toEqual([]);
    expect(readStoreVersions({ publishedItemRevisionStatus: { distributionChannels: [null, {}] } })).toEqual([]);
  });
});

describe('evaluateVersion', () => {
  it('publishes when the manifest is higher than every store version', () => {
    const localThis = { status: statusWith({ published: ['1.2.0'], submitted: ['1.2.3'] }) };

    expect(evaluateVersion('1.2.4', localThis.status)).toEqual({
      publish: true,
      storeVersions: ['1.2.3', '1.2.0']
    });
  });

  it('skips when the manifest equals or trails the highest store version', () => {
    const localThis = { status: statusWith({ published: ['1.2.0'], submitted: ['1.2.3'] }) };

    expect(evaluateVersion('1.2.3', localThis.status).publish).toBe(false);
    expect(evaluateVersion('1.2.1', localThis.status).publish).toBe(false);
  });

  it('publishes when the store has no versions yet', () => {
    expect(evaluateVersion('1.2.3', {})).toEqual({ publish: true, storeVersions: [] });
  });

  it('rejects a manifest version that is not SemVer', () => {
    expect(() => evaluateVersion('latest', {})).toThrow('Manifest version "latest" is not valid SemVer.');
  });
});

describe('fetchChromeWebStoreStatus', () => {
  it('calls fetchStatus with the bearer token and returns the parsed body', async () => {
    mockFetch({ ok: true, text: async () => '{"itemId":"ext"}' });

    await expect(fetchChromeWebStoreStatus(credentials)).resolves.toEqual({ itemId: 'ext' });
    expect(fetch).toHaveBeenCalledWith(
      'https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext:fetchStatus',
      { headers: { Authorization: 'Bearer token' } }
    );
  });

  it('includes the status and response body in the error', async () => {
    mockFetch({ ok: false, status: 403, text: async () => 'denied' });

    await expect(fetchChromeWebStoreStatus(credentials)).rejects.toThrow(
      'Chrome Web Store fetchStatus failed (403): denied'
    );
  });
});

describe('runVersionCheck', () => {
  it('reports publish=true to the step output for a higher version', async () => {
    const localThis = { result: undefined, output: undefined };
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    mockFetch({ ok: true, text: async () => JSON.stringify(statusWith({ published: ['1.2.0'] })) });

    await withDirectory(async (root) => {
      writeFileSync(join(root, 'manifest.json'), '{"version":"1.2.4"}');
      writeFileSync(join(root, 'out'), '');
      localThis.result = await runVersionCheck({
        ...credentials,
        manifestPath: join(root, 'manifest.json'),
        githubOutput: join(root, 'out')
      });
      localThis.output = readFileSync(join(root, 'out'), 'utf8');
    });

    expect(localThis.result.publish).toBe(true);
    expect(localThis.output).toBe('publish=true\n');
    expect(process.stdout.write).toHaveBeenCalledWith('Publishing 1.2.4 (store has: 1.2.0).\n');
  });

  it('reports publish=false with a notice when the version is not higher', async () => {
    const localThis = { result: undefined, output: undefined };
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    mockFetch({ ok: true, text: async () => JSON.stringify(statusWith({ submitted: ['1.2.4'] })) });

    await withDirectory(async (root) => {
      writeFileSync(join(root, 'manifest.json'), '{"version":"1.2.4"}');
      writeFileSync(join(root, 'out'), '');
      localThis.result = await runVersionCheck({
        ...credentials,
        manifestPath: join(root, 'manifest.json'),
        githubOutput: join(root, 'out')
      });
      localThis.output = readFileSync(join(root, 'out'), 'utf8');
    });

    expect(localThis.result.publish).toBe(false);
    expect(localThis.output).toBe('publish=false\n');
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('::notice::Skipping'));
  });

  it('reports an empty store and works without a step output file', async () => {
    const localThis = { result: undefined };
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    mockFetch({ ok: true, text: async () => '{}' });

    await withDirectory(async (root) => {
      writeFileSync(join(root, 'manifest.json'), '{"version":"1.0.0"}');
      localThis.result = await runVersionCheck({ ...credentials, manifestPath: join(root, 'manifest.json') });
    });

    expect(localThis.result.publish).toBe(true);
    expect(process.stdout.write).toHaveBeenCalledWith('Publishing 1.0.0 (store has: none).\n');
  });
});

describe('check-chrome-web-store-version CLI', () => {
  it('requires the store credentials', () => {
    const localThis = { stderr: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, ACCESS_TOKEN: '', PUBLISHER_ID: '', EXTENSION_ID: '' }
      });
    } catch (error) {
      localThis.stderr = error.stderr.toString();
    }

    expect(localThis.stderr).toContain('ACCESS_TOKEN, PUBLISHER_ID, and EXTENSION_ID are required');
  });
});
