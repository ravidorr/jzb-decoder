import { describe, expect, it } from 'vitest';

import {
  extractChangelogNotes,
  requiresRelease,
  validateRelease,
  validateTaggedRelease
} from '../scripts/check-release.mjs';

describe('check-release', () => {
  it('extracts only the requested changelog section', () => {
    const localThis = {
      changelog:
        '## [1.2.3] - 2026-10-11\n\n- Baseline.\n\n## [1.2.2] - 2026-09-21\n\n- Earlier.\n',
      notes: undefined
    };

    localThis.notes = extractChangelogNotes(localThis.changelog, '1.2.3');

    expect(localThis.notes).toBe('\n- Baseline.\n');
  });

  it('requires a release for source and package changes only', () => {
    const localThis = {
      tooling: ['.github/workflows/ci.yml', 'scripts/check-release.mjs'],
      source: ['src/index.js'],
      packageJson: ['package.json'],
      extensionRuntime: ['panel.js']
    };

    expect(requiresRelease(localThis.tooling)).toBe(false);
    expect(requiresRelease(localThis.source)).toBe(true);
    expect(requiresRelease(localThis.packageJson)).toBe(true);
    expect(requiresRelease(localThis.extensionRuntime)).toBe(true);
  });

  it('validates an increased version with matching notes', () => {
    const localThis = {
      changelog: '## [1.2.3] - 2026-10-11\n\n- Baseline.\n',
      result: undefined
    };

    localThis.result = validateRelease('1.2.2', '1.2.3', localThis.changelog);

    expect(localThis.result).toBeUndefined();
  });

  it('rejects an unchanged version and empty notes', () => {
    const localThis = {
      changelog: '## [1.2.3] - 2026-10-11\n\n## [1.2.2] - 2026-09-21\n\n- Earlier.\n'
    };

    expect(() => validateRelease('1.2.3', '1.2.3', localThis.changelog)).toThrow(
      'package version must change'
    );
    expect(() => validateRelease('1.2.2', '1.2.3', localThis.changelog)).toThrow(
      'CHANGELOG.md must contain a non-empty section for 1.2.3'
    );
  });

  it('validates a matching tag and rejects missing notes', () => {
    const localThis = {
      valid: {
        tagName: 'v1.2.3',
        packageVersion: '1.2.3',
        changelog: '## [1.2.3] - 2026-10-11\n\n- Baseline.\n',
        releaseNotes: '- Baseline.\n'
      },
      missingNotes: {
        tagName: 'v1.2.3',
        packageVersion: '1.2.3',
        changelog: '## [1.2.3] - 2026-10-11\n\n- Baseline.\n',
        releaseNotes: ''
      }
    };

    expect(() => validateTaggedRelease(localThis.valid)).not.toThrow();
    expect(() => validateTaggedRelease(localThis.missingNotes)).toThrow(
      'release notes must not be empty'
    );
  });
});
