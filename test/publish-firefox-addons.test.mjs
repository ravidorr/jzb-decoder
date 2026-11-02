import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHmac } from 'node:crypto';

import {
  createJwt,
  evaluateVersion,
  fetchAmoVersions,
  runCli,
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

function textResponse(body, status = 200) {
  return { ok: status < 400, status, text: () => Promise.resolve(body) };
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
  vi.useRealTimers();
  vi.unstubAllEnvs();
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
    expect(signature).toBe(createHmac('sha256', 'secret').update(`${header}.${payload}`).digest('base64url'));
  });

  it('uses a unique jti per token', () => {
    const jti = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).jti;

    expect(jti(createJwt(credentials))).not.toBe(jti(createJwt(credentials)));
  });

  it('defaults the issue time to now', () => {
    const [, payload] = createJwt(credentials).split('.');

    expect(JSON.parse(Buffer.from(payload, 'base64url').toString()).iat).toBeGreaterThan(0);
  });
});

describe('evaluateVersion', () => {
  it('publishes when AMO has no versions', () => {
    expect(evaluateVersion('1.3.0', [])).toEqual({ publish: true, storeVersions: [], ignoredVersions: [] });
  });

  it('publishes when the manifest version is higher', () => {
    expect(evaluateVersion('1.3.0', ['1.2.4', '1.2.0']).publish).toBe(true);
  });

  it('skips when the same or a newer version exists, ignoring non-SemVer versions', () => {
    expect(evaluateVersion('1.3.0', ['1.3.0', 'weird']).publish).toBe(false);
    expect(evaluateVersion('1.3.0', ['2.0.0']).publish).toBe(false);
  });

  it('compares versions numerically, not lexically', () => {
    expect(evaluateVersion('1.3.0', ['1.2.0', '1.3.0', '1.10.0'])).toMatchObject({
      publish: false,
      storeVersions: ['1.10.0', '1.3.0', '1.2.0']
    });
  });

  it('treats a prerelease store version as lower than the release', () => {
    expect(evaluateVersion('1.3.0', ['1.3.0-beta.1']).publish).toBe(true);
  });

  it('reports versions it cannot compare', () => {
    expect(evaluateVersion('1.3.0', ['1.0.0.1', '1.2.0'])).toMatchObject({
      publish: true,
      ignoredVersions: ['1.0.0.1']
    });
  });

  it('rejects an invalid manifest version', () => {
    expect(() => evaluateVersion('nope', [])).toThrow('not valid SemVer');
  });
});

describe('fetchAmoVersions', () => {
  it('follows pagination and sends the JWT header', async () => {
    const fetchMock = mockFetch(
      versionsPage(['1.0.0'], 'https://addons.mozilla.org/api/v5/addons/next'),
      versionsPage(['1.1.0'])
    );

    await expect(fetchAmoVersions({ credentials, addonId: 'id@example' })).resolves.toEqual(['1.0.0', '1.1.0']);
    expect(fetchMock.mock.calls[0][0]).toContain('filter=all_with_unlisted');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^JWT /);
    expect(fetchMock.mock.calls[1][0]).toBe('https://addons.mozilla.org/api/v5/addons/next');
  });

  it('refuses to send credentials to a next page outside the AMO API', async () => {
    const fetchMock = mockFetch(versionsPage(['1.0.0'], 'https://evil.example/next'));

    await expect(fetchAmoVersions({ credentials, addonId: 'id' })).rejects.toThrow('Refusing to send AMO credentials');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails when the response has no results list', async () => {
    mockFetch(jsonResponse({ next: null }));

    await expect(fetchAmoVersions({ credentials, addonId: 'id' })).rejects.toThrow('no results list');
  });

  it('names the request when the body is not JSON', async () => {
    mockFetch(textResponse('<html>maintenance</html>'));

    await expect(fetchAmoVersions({ credentials, addonId: 'id' })).rejects.toThrow('not JSON: <html>maintenance</html>');
  });

  it('explains network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })));

    await expect(fetchAmoVersions({ credentials, addonId: 'id' })).rejects.toThrow('could not complete: ENOTFOUND');
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

  it('gives up after five minutes of polling and names the upload', async () => {
    await withFixture(async (root) => {
      const { packagePath } = writeFixtureFiles(root);
      const sleeper = vi.fn().mockResolvedValue();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ processed: false, uuid: 'abc' }));

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        submitVersion({ credentials, addonId: 'id', packagePath, releaseNotes: 'n', sleep: sleeper })
      ).rejects.toThrow('did not finish processing upload abc within 5 minutes');
      expect(fetchMock).toHaveBeenCalledTimes(61);
      expect(sleeper).toHaveBeenCalledWith(5000);
    });
  });

  it('fails when the upload response has no uuid', async () => {
    await withFixture(async (root) => {
      const { packagePath } = writeFixtureFiles(root);

      mockFetch(jsonResponse({}));

      await expect(
        submitVersion({ credentials, addonId: 'id', packagePath, releaseNotes: 'n', sleep })
      ).rejects.toThrow('no uuid');
    });
  });

  it('includes the status and body when creating the version fails', async () => {
    await withFixture(async (root) => {
      const { packagePath } = writeFixtureFiles(root);

      mockFetch(
        jsonResponse({ uuid: 'abc' }),
        jsonResponse({ processed: true, valid: true }),
        jsonResponse({ detail: 'version exists' }, 409)
      );

      await expect(
        submitVersion({ credentials, addonId: 'id', packagePath, releaseNotes: 'n', sleep })
      ).rejects.toThrow('failed (409): {"detail":"version exists"}');
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
        "::notice::Skipping Firefox Add-ons publish: 1.3.0 is not higher than AMO's highest version 1.3.0.\n"
      );
    });
  });

  it('warns when AMO is ahead of the repository', async () => {
    await withFixture(async (root) => {
      const paths = writeFixtureFiles(root);

      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(versionsPage(['1.4.0', 'odd']));

      await runPublish({ credentials, addonId: 'id', ...paths, sleep });

      expect(process.stdout.write).toHaveBeenCalledWith('::warning::Ignoring AMO versions that are not valid SemVer: odd.\n');
      expect(process.stdout.write).toHaveBeenCalledWith(
        "::warning::Skipping Firefox Add-ons publish: 1.3.0 is not higher than AMO's highest version 1.4.0.\n"
      );
    });
  });

  it('refuses to submit when the changelog has no notes for the version', async () => {
    await withFixture(async (root) => {
      const paths = writeFixtureFiles(root);

      writeFileSync(paths.changelogPath, '## [Unreleased]\n\n## [1.3.00] - 2026-11-02\n\n- Other\n');

      const fetchMock = mockFetch(versionsPage(['1.2.4']));

      await expect(runPublish({ credentials, addonId: 'id', ...paths, sleep })).rejects.toThrow(
        'has no notes for 1.3.0; refusing to submit'
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('fails before any request when the manifest is missing', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    await expect(runPublish({ credentials, addonId: 'id', manifestPath: '/nonexistent/manifest.json' })).rejects.toThrow(
      'ENOENT'
    );
    expect(fetchMock).not.toHaveBeenCalled();
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
  const variables = ['AMO_JWT_ISSUER', 'AMO_JWT_SECRET', 'ADDON_ID'];

  function withEnvironment(values, run) {
    return withFixture(async (root) => {
      for (const [name, value] of Object.entries({ ...{ AMO_JWT_ISSUER: 'i', AMO_JWT_SECRET: 's', ADDON_ID: 'id', MANIFEST_PATH: '', PACKAGE_PATH: '' }, ...values })) {
        vi.stubEnv(name, value);
      }

      await run(root);
    });
  }

  it.each(variables)('requires %s', async (name) => {
    await withEnvironment({ [name]: '' }, async () => {
      await expect(runCli()).rejects.toThrow(`${name} is required`);
    });
  });

  it('lists every missing variable', async () => {
    await withEnvironment({ AMO_JWT_ISSUER: '', ADDON_ID: '' }, async () => {
      await expect(runCli()).rejects.toThrow('AMO_JWT_ISSUER, ADDON_ID are required');
    });
  });

  it('runs the publish with the manifest path from the environment', async () => {
    await withEnvironment({}, async (root) => {
      const { manifestPath } = writeFixtureFiles(root);

      vi.stubEnv('MANIFEST_PATH', manifestPath);
      vi.stubEnv('PACKAGE_PATH', '/unused.zip');
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      mockFetch(versionsPage(['1.3.0']));

      await runCli();

      expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Skipping Firefox Add-ons publish'));
    });
  });

  it('exits non-zero and annotates the failure when run as a script', () => {
    const localThis = { error: undefined };

    try {
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, AMO_JWT_ISSUER: '', AMO_JWT_SECRET: '', ADDON_ID: '' }
      });
    } catch (error) {
      localThis.error = error;
    }

    expect(localThis.error.status).toBe(1);
    expect(localThis.error.stderr.toString()).toContain(
      '::error::AMO_JWT_ISSUER, AMO_JWT_SECRET, ADDON_ID are required'
    );
  });
});
