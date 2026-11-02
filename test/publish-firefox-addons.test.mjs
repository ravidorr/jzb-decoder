import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createJwt,
  evaluateVersion,
  fetchAmoVersions,
  runPublish,
  submitVersion
} from '../scripts/publish-firefox-addons.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(testDirectory, '..', 'scripts', 'publish-firefox-addons.mjs');
const credentials = { issuer: 'user:1', secret: 'secret' };
const sleep = () => Promise.resolve();

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, text: () => Promise.resolve(JSON.stringify(body)) };
}

function versionsPage(versions, next = null) {
  return jsonResponse({ next, results: versions.map((version) => ({ version })) });
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
  const localThis = { root: mkdtempSync(join(tmpdir(), 'amo-publish-')) };

  try {
    return await run(localThis.root);
  } finally {
    rmSync(localThis.root, { recursive: true, force: true });
  }
}

function writeFixtureFiles(root, version = '1.3.0') {
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version }));
  writeFileSync(join(root, 'jzb-decoder.zip'), 'zip');
  writeFileSync(join(root, 'CHANGELOG.md'), `## [Unreleased]\n\n## [${version}] - 2026-11-02\n\n- Added things\n`);

  return {
    manifestPath: join(root, 'manifest.json'),
    packagePath: join(root, 'jzb-decoder.zip'),
    changelogPath: join(root, 'CHANGELOG.md')
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createJwt', () => {
  it('signs an HS256 token with the issuer and a short expiry', () => {
    const [header, payload, signature] = createJwt({ ...credentials, now: 1_700_000_000_000 }).split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(claims).toMatchObject({ iss: 'user:1', iat: 1_700_000_000, exp: 1_700_000_060 });
    expect(claims.jti).toBeTruthy();
    expect(signature).toMatch(/^[\w-]+$/);
  });

  it('defaults the issue time to now', () => {
    const [, payload] = createJwt(credentials).split('.');

    expect(JSON.parse(Buffer.from(payload, 'base64url').toString()).iat).toBeGreaterThan(0);
  });
});

describe('evaluateVersion', () => {
  it('publishes when AMO has no versions', () => {
    expect(evaluateVersion('1.3.0', [])).toEqual({ publish: true, storeVersions: [] });
  });

  it('publishes when the manifest version is higher', () => {
    expect(evaluateVersion('1.3.0', ['1.2.4', '1.2.0']).publish).toBe(true);
  });

  it('skips when the same or a newer version exists, ignoring non-SemVer versions', () => {
    expect(evaluateVersion('1.3.0', ['1.3.0', 'weird']).publish).toBe(false);
    expect(evaluateVersion('1.3.0', ['2.0.0']).publish).toBe(false);
  });

  it('rejects an invalid manifest version', () => {
    expect(() => evaluateVersion('nope', [])).toThrow('not valid SemVer');
  });
});

describe('fetchAmoVersions', () => {
  it('follows pagination and sends the JWT header', async () => {
    const fetchMock = mockFetch(
      versionsPage(['1.0.0'], 'https://addons.mozilla.org/next'),
      versionsPage(['1.1.0'])
    );

    await expect(fetchAmoVersions({ credentials, addonId: 'id@example' })).resolves.toEqual(['1.0.0', '1.1.0']);
    expect(fetchMock.mock.calls[0][0]).toContain('filter=all_with_unlisted');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^JWT /);
    expect(fetchMock.mock.calls[1][0]).toBe('https://addons.mozilla.org/next');
  });

  it('includes the API error body when a request fails', async () => {
    mockFetch(jsonResponse({ detail: 'bad credentials' }, 401));

    await expect(fetchAmoVersions({ credentials, addonId: 'id' })).rejects.toThrow(
      'failed (401): {"detail":"bad credentials"}'
    );
  });
});

describe('submitVersion', () => {
  it('uploads, waits for validation, and creates the version with release notes', async () => {
    await withFixture(async (root) => {
      const { packagePath } = writeFixtureFiles(root);
      const fetchMock = mockFetch(
        jsonResponse({ uuid: 'abc' }),
        jsonResponse({ processed: false }),
        jsonResponse({ processed: true, valid: true }),
        jsonResponse({ version: '1.3.0' })
      );

      const result = await submitVersion({
        credentials,
        addonId: 'id@example',
        packagePath,
        releaseNotes: 'Notes',
        sleep
      });

      expect(result.version).toBe('1.3.0');
      expect(fetchMock.mock.calls[0][1].body.get('channel')).toBe('listed');
      expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
        upload: 'abc',
        release_notes: { 'en-US': 'Notes' }
      });
    });
  });

  it('fails with the validation results when AMO rejects the upload', async () => {
    await withFixture(async (root) => {
      const { packagePath } = writeFixtureFiles(root);

      mockFetch(
        jsonResponse({ uuid: 'abc' }),
        jsonResponse({ processed: true, valid: false, validation: { errors: 1 } })
      );

      await expect(
        submitVersion({ credentials, addonId: 'id', packagePath, releaseNotes: 'n', sleep })
      ).rejects.toThrow('AMO rejected the upload: {"errors":1}');
    });
  });

  it('gives up when processing never finishes', async () => {
    await withFixture(async (root) => {
      const { packagePath } = writeFixtureFiles(root);
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ processed: false, uuid: 'abc' }));

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        submitVersion({ credentials, addonId: 'id', packagePath, releaseNotes: 'n', sleep })
      ).rejects.toThrow('did not finish processing');
    });
  });
});

describe('runPublish', () => {
  it('skips with a notice when AMO already has the version', async () => {
    await withFixture(async (root) => {
      const paths = writeFixtureFiles(root);

      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(versionsPage(['1.3.0']));

      const result = await runPublish({ credentials, addonId: 'id', ...paths, sleep });

      expect(result.published).toBe(false);
      expect(process.stdout.write).toHaveBeenCalledWith(
        "::notice::Skipping Firefox Add-ons publish: 1.3.0 is not higher than AMO's 1.3.0.\n"
      );
    });
  });

  it('submits the new version with the changelog section as release notes', async () => {
    await withFixture(async (root) => {
      const paths = writeFixtureFiles(root);

      vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      const fetchMock = mockFetch(
        versionsPage(['1.2.4']),
        jsonResponse({ uuid: 'abc' }),
        jsonResponse({ processed: true, valid: true }),
        jsonResponse({ version: '1.3.0' })
      );
      const result = await runPublish({ credentials, addonId: 'id', ...paths, sleep });

      expect(result).toMatchObject({ published: true, storeVersions: ['1.2.4'] });
      expect(JSON.parse(fetchMock.mock.calls[3][1].body).release_notes['en-US']).toContain('- Added things');
    });
  });

  it('reports "none" when AMO has no versions yet', async () => {
    await withFixture(async (root) => {
      const paths = writeFixtureFiles(root);

      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(
        versionsPage([]),
        jsonResponse({ uuid: 'abc' }),
        jsonResponse({ processed: true, valid: true }),
        jsonResponse({ version: '1.3.0' })
      );
      await runPublish({ credentials, addonId: 'id', ...paths, sleep });

      expect(process.stdout.write).toHaveBeenCalledWith('Publishing 1.3.0 to Firefox Add-ons (AMO has: none).\n');
    });
  });

  it('waits between polls using real timers by default', async () => {
    await withFixture(async (root) => {
      const { manifestPath, packagePath, changelogPath } = writeFixtureFiles(root);

      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      vi.useFakeTimers();
      mockFetch(
        versionsPage([]),
        jsonResponse({ uuid: 'abc' }),
        jsonResponse({ processed: false }),
        jsonResponse({ processed: true, valid: true }),
        jsonResponse({ version: '1.3.0' })
      );

      const pending = runPublish({ credentials, addonId: 'id', manifestPath, packagePath, changelogPath });

      await vi.runAllTimersAsync();
      vi.useRealTimers();

      await expect(pending).resolves.toMatchObject({ published: true });
    });
  });
});

describe('publish-firefox-addons CLI', () => {
  it('requires the AMO credentials and add-on ID', () => {
    const localThis = { stderr: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, AMO_JWT_ISSUER: '', AMO_JWT_SECRET: '', ADDON_ID: '' }
      });
    } catch (error) {
      localThis.stderr = error.stderr.toString();
    }

    expect(localThis.stderr).toContain('AMO_JWT_ISSUER, AMO_JWT_SECRET, and ADDON_ID are required');
  });
});
