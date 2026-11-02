import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { publishDraft, runPublish, uploadPackage } from '../scripts/publish-edge-addons.mjs';

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

      await uploadPackage({ credentials, productId: 'prod', packagePath, sleep });

      expect(fetchMock.mock.calls[0][0]).toContain('/prod/submissions/draft/package');
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        Authorization: 'ApiKey key',
        'X-ClientID': 'client',
        'Content-Type': 'application/zip'
      });
      expect(fetchMock.mock.calls[1][0]).toContain('/draft/package/operations/upload-1');
    });
  });

  it('fails with the operation details when processing fails', async () => {
    await withFixture(async ({ packagePath }) => {
      mockFetch(accepted(), operation({ status: 'Failed', errorCode: 'BadPackage' }));

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'package upload failed: {"status":"Failed","errorCode":"BadPackage"}'
      );
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

  it('gives up when processing never finishes', async () => {
    await withFixture(async ({ packagePath }) => {
      const fetchMock = vi.fn().mockResolvedValue(operation({ status: 'InProgress' }));

      fetchMock.mockResolvedValueOnce(accepted());
      vi.stubGlobal('fetch', fetchMock);

      await expect(uploadPackage({ credentials, productId: 'p', packagePath, sleep })).rejects.toThrow(
        'did not finish the operation'
      );
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
  ])('skips with a notice on %s', async (errorCode, reason) => {
    await withFixture(async (paths) => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(accepted(), operation({ status: 'Succeeded' }), accepted(), operation({ status: 'Failed', errorCode }));

      const result = await runPublish({ credentials, productId: 'p', ...paths, sleep });

      expect(result.published).toBe(false);
      expect(process.stdout.write).toHaveBeenCalledWith(
        `::notice::Skipping Microsoft Edge Add-ons publish of 1.3.0: ${reason}.\n`
      );
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
  it('requires the Partner Center credentials and product ID', () => {
    const localThis = { stderr: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, EDGE_CLIENT_ID: '', EDGE_API_KEY: '', EDGE_PRODUCT_ID: '' }
      });
    } catch (error) {
      localThis.stderr = error.stderr.toString();
    }

    expect(localThis.stderr).toContain('EDGE_CLIENT_ID, EDGE_API_KEY, and EDGE_PRODUCT_ID are required');
  });
});
