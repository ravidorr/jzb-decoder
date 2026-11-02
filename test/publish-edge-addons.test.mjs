import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { publishDraft, runCli, runPublish, uploadPackage } from '../scripts/publish-edge-addons.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(testDirectory, '..', 'scripts', 'publish-edge-addons.mjs');
const credentials = { clientId: 'client', apiKey: 'key' };
const sleep = () => Promise.resolve();

function accepted(operationId = 'op-1') {
  return {
    ok: true,
    status: 202,
    headers: { get: () => `/operations/${operationId}` },
    text: () => Promise.resolve('')
  };
}

function acceptedAt(location) {
  return { ok: true, status: 202, headers: { get: () => location }, text: () => Promise.resolve('') };
}

function operation(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, text: () => Promise.resolve(JSON.stringify(body)) };
}

function mockFetch(...responses) {
  const fetchMock = vi.fn();

  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

async function withFixture(run) {
  const localThis = { root: mkdtempSync(join(tmpdir(), 'edge-publish-')) };

  try {
    writeFileSync(join(localThis.root, 'manifest.json'), '{"version":"1.3.0"}');
    writeFileSync(join(localThis.root, 'jzb-decoder.zip'), 'zip');

    return await run({
      manifestPath: join(localThis.root, 'manifest.json'),
      packagePath: join(localThis.root, 'jzb-decoder.zip')
    });
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('uploadPackage', () => {
  it('uploads the zip with API key headers and polls until it succeeds', async () => {
    await withFixture(async ({ packagePath }) => {
      const fetchMock = mockFetch(
        accepted('upload-1'),
        operation({ status: 'InProgress' }),
        operation({ status: 'Succeeded' })
      );

      await expect(uploadPackage({ credentials, productId: 'prod', packagePath, sleep })).resolves.toEqual({
        status: 'Succeeded'
      });

      expect(fetchMock.mock.calls[0][0]).toContain('/prod/submissions/draft/package');
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        Authorization: 'ApiKey key',
        'X-ClientID': 'client',
        'Content-Type': 'application/zip'
      });
      expect(fetchMock.mock.calls[1][0]).toContain('/draft/package/operations/upload-1');
    });
  });

  it('returns a failed operation for the caller to judge', async () => {
    await withFixture(async ({ packagePath }) => {
      mockFetch(accepted(), operation({ status: 'Failed', errorCode: 'BadPackage' }));

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).resolves.toEqual({
        status: 'Failed',
        errorCode: 'BadPackage'
      });
    });
  });

  it('includes the API error body when the upload request fails', async () => {
    await withFixture(async ({ packagePath }) => {
      mockFetch(operation({ message: 'unauthorized' }, 401));

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'failed (401): {"message":"unauthorized"}'
      );
    });
  });

  it('fails when no operation ID comes back', async () => {
    await withFixture(async ({ packagePath }) => {
      mockFetch(operation({}, 202));

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'did not return an operation ID'
      );
    });
  });

  it.each([
    ['https://api.example/v1/products/p/submissions/draft/package/operations/abc/', 'abc'],
    ['/operations/abc', 'abc']
  ])('reads the operation ID from the Location header %s', async (location, id) => {
    await withFixture(async ({ packagePath }) => {
      const fetchMock = mockFetch(acceptedAt(location), operation({ status: 'Succeeded' }));

      await uploadPackage({ credentials, productId: 'p', packagePath, sleep });

      expect(fetchMock.mock.calls[1][0]).toMatch(new RegExp(`/draft/package/operations/${id}$`));
    });
  });

  it('rejects a Location header with no usable ID', async () => {
    await withFixture(async ({ packagePath }) => {
      mockFetch(acceptedAt('/'));

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'unusable Location header: /'
      );
    });
  });

  it('names the request when a status body is not JSON', async () => {
    await withFixture(async ({ packagePath }) => {
      mockFetch(accepted(), { ok: true, status: 200, headers: { get: () => null }, text: () => Promise.resolve('<html>') });

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'not JSON: <html>'
      );
    });
  });

  it('explains network failures', async () => {
    await withFixture(async ({ packagePath }) => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })));

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'could not complete: ECONNRESET'
      );
    });
  });

  it('gives up after five minutes of polling and names the operation', async () => {
    await withFixture(async ({ packagePath }) => {
      const sleeper = vi.fn().mockResolvedValue();
      const fetchMock = vi.fn().mockResolvedValue(operation({ status: 'InProgress' }));

      fetchMock.mockResolvedValueOnce(accepted('slow'));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        uploadPackage({ credentials, productId: 'p', packagePath, sleep: sleeper })
      ).rejects.toThrow('operations/slow did not finish within 5 minutes');
      expect(fetchMock).toHaveBeenCalledTimes(61);
      expect(sleeper).toHaveBeenCalledWith(5000);
    });
  });
});

describe('publishDraft', () => {
  it('submits the notes as JSON and returns the final operation', async () => {
    const fetchMock = mockFetch(accepted('pub-1'), operation({ status: 'Succeeded' }));

    await expect(publishDraft({ credentials, productId: 'p', notes: 'n', sleep })).resolves.toEqual({
      status: 'Succeeded'
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ notes: 'n' });
    expect(fetchMock.mock.calls[1][0]).toContain('/p/submissions/operations/pub-1');
  });
});

describe('runPublish', () => {
  it('uploads and publishes a new version', async () => {
    await withFixture(async (paths) => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(
        accepted(),
        operation({ status: 'Succeeded' }),
        accepted(),
        operation({ status: 'Succeeded', message: 'Successfully created submission' })
      );

      const result = await runPublish({ credentials, productId: 'p', ...paths, sleep });

      expect(result).toEqual({ published: true, manifestVersion: '1.3.0' });
      expect(process.stdout.write).toHaveBeenCalledWith(
        'Submitted version 1.3.0 to Microsoft Edge Add-ons: Successfully created submission\n'
      );
    });
  });

  it.each([
    ['InProgressSubmission', 'a submission is already in review'],
    ['NoModulesUpdated', 'the store already has this package']
  ])('warns and skips on %s at the publish step', async (errorCode, reason) => {
    await withFixture(async (paths) => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(accepted(), operation({ status: 'Succeeded' }), accepted(), operation({ status: 'Failed', errorCode }));

      const result = await runPublish({ credentials, productId: 'p', ...paths, sleep });

      expect(result.published).toBe(false);
      expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining(`::warning::Microsoft Edge Add-ons did not receive 1.3.0: ${reason}.`));
    });
  });

  it('skips without publishing when the upload reports a submission in review', async () => {
    await withFixture(async (paths) => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      const fetchMock = mockFetch(accepted(), operation({ status: 'Failed', errorCode: 'InProgressSubmission' }));
      const result = await runPublish({ credentials, productId: 'p', ...paths, sleep });

      expect(result.published).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('fails when the upload fails for any other reason', async () => {
    await withFixture(async (paths) => {
      mockFetch(accepted(), operation({ status: 'Failed', errorCode: 'BadPackage' }));

      await expect(runPublish({ credentials, productId: 'p', ...paths, sleep })).rejects.toThrow(
        'package upload failed: {"status":"Failed","errorCode":"BadPackage"}'
      );
    });
  });

  it('fails when the publish operation has no error code', async () => {
    await withFixture(async (paths) => {
      mockFetch(accepted(), operation({ status: 'Succeeded' }), accepted(), operation({ status: 'Failed' }));

      await expect(runPublish({ credentials, productId: 'p', ...paths, sleep })).rejects.toThrow(
        'publish failed: {"status":"Failed"}'
      );
    });
  });

  it('fails before any request when the package is missing', async () => {
    await withFixture(async ({ manifestPath }) => {
      const fetchMock = vi.fn();

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        runPublish({ credentials, productId: 'p', manifestPath, packagePath: '/nonexistent/x.zip', sleep })
      ).rejects.toThrow('ENOENT');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('fails on any other publish failure and prints the operation', async () => {
    await withFixture(async (paths) => {
      mockFetch(
        accepted(),
        operation({ status: 'Succeeded' }),
        accepted(),
        operation({ status: 'Failed', errorCode: 'SubmissionValidationError', errors: ['bad'] })
      );

      await expect(runPublish({ credentials, productId: 'p', ...paths, sleep })).rejects.toThrow(
        'Edge Add-ons publish failed: {"status":"Failed","errorCode":"SubmissionValidationError","errors":["bad"]}'
      );
    });
  });

  it('waits between polls using real timers by default', async () => {
    await withFixture(async (paths) => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      vi.useFakeTimers();
      mockFetch(
        accepted(),
        operation({ status: 'InProgress' }),
        operation({ status: 'Succeeded' }),
        accepted(),
        operation({ status: 'Succeeded', message: 'ok' })
      );

      const pending = runPublish({ credentials, productId: 'p', ...paths });

      await vi.runAllTimersAsync();
      vi.useRealTimers();

      await expect(pending).resolves.toMatchObject({ published: true });
    });
  });
});

describe('publish-edge-addons CLI', () => {
  const variables = ['EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID'];

  function withEnvironment(values, run) {
    return withFixture(async (paths) => {
      for (const [name, value] of Object.entries({ ...{ EDGE_CLIENT_ID: 'c', EDGE_API_KEY: 'k', EDGE_PRODUCT_ID: 'p', MANIFEST_PATH: '', PACKAGE_PATH: '' }, ...values })) {
        vi.stubEnv(name, value);
      }

      await run(paths);
    });
  }

  it.each(variables)('requires %s', async (name) => {
    await withEnvironment({ [name]: '' }, async () => {
      await expect(runCli()).rejects.toThrow(`${name} is required`);
    });
  });

  it('lists every missing variable', async () => {
    await withEnvironment({ EDGE_CLIENT_ID: '', EDGE_API_KEY: '' }, async () => {
      await expect(runCli()).rejects.toThrow('EDGE_CLIENT_ID, EDGE_API_KEY are required');
    });
  });

  it('runs the publish with the manifest path from the environment', async () => {
    await withEnvironment({}, async ({ manifestPath, packagePath }) => {
      vi.stubEnv('MANIFEST_PATH', manifestPath);
      vi.stubEnv('PACKAGE_PATH', packagePath);
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(accepted(), operation({ status: 'Failed', errorCode: 'NoModulesUpdated' }));

      await runCli();

      expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('did not receive 1.3.0'));
    });
  });

  it('exits non-zero and annotates the failure when run as a script', () => {
    const localThis = { error: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, EDGE_CLIENT_ID: '', EDGE_API_KEY: '', EDGE_PRODUCT_ID: '' }
      });
    } catch (error) {
      localThis.error = error;
    }

    expect(localThis.error.status).toBe(1);
    expect(localThis.error.stderr.toString()).toContain(
      '::error::EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID are required'
    );
  });
});
