# Publishing to Firefox AMO

JZB Decoder ships as a Manifest V3 WebExtension. Upload `dist/jzb-decoder.zip` built from this repository.

For Chrome Web Store steps, see [README.md](../../README.md#chrome-web-store).

## Automated publishing

Merging a pull request into `main` submits the new version to
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/jzb-decoder/) for review. The
`publish-firefox` job in `.github/workflows/publish-stores.yml` does this, next to the Chrome and Edge jobs.
It runs only when the shared `changes` job finds that the pull request changed shipped extension files
(`scripts/should-publish.mjs`; see [chrome.md](chrome.md#how-it-works)). Docs-only, test-only, and tooling-only
pull requests are skipped.

The job:

1. Runs `npm ci`, `npm run check-version`, `npm run package`, and `scripts/verify-package.sh`.
2. Runs `web-ext lint` (pinned to `web-ext@10.8.0`, run through `npx`) on a copy of the unpacked package that the
   same job then submits. Lint errors stop the job before the upload; warnings do not. The AMO secrets are passed
   only to the submit step, not to the lint step.
3. Runs `scripts/publish-firefox-addons.mjs`, which lists every SemVer-valid AMO version of the add-on
   (including versions awaiting review, rejected, or unlisted; other version strings are reported with a
   warning). If one of them is the manifest version or newer, it prints a notice (a warning when AMO is ahead of
   the repository) and exits successfully without submitting.
4. Otherwise it uploads `dist/jzb-decoder.zip` to the `listed` channel, waits for AMO validation, and creates
   the version with the matching `CHANGELOG.md` section as the release notes. The job fails instead of submitting
   when that section is empty.

A concurrency group (`firefox-addons-publish`) serializes runs. The job checks out the latest `main` rather than
the merge commit of the run that started it, so a delayed run still submits the newest version. A failure here
does not affect the Chrome or Edge jobs. API error bodies are printed in the logs. Source code upload is not
needed: the package is plain, unminified JavaScript.

### Required configuration

The job uses the `firefox-addons` GitHub environment. Create it under Settings, Environments. To require a
manual approval before each submission, add required reviewers to that environment.

| Name | Kind | Value |
| --- | --- | --- |
| `AMO_JWT_ISSUER` | Environment secret | The JWT issuer (API key) from the AMO API keys page |
| `AMO_JWT_SECRET` | Environment secret | The JWT secret from the same page |
| `AMO_ADDON_ID` | Environment variable | `jzb-decoder@ravidorr.github.io` |

### One-time setup

1. Sign in to the [Developer Hub](https://addons.mozilla.org/developers/) with the account that owns the add-on.
2. Open [Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/) and generate credentials.
3. Add the issuer and secret as the environment secrets above. The secret is shown only once.
4. Make sure the listing already has a name, summary, license, and categories. This automation only
   creates new versions; it does not set or change listing metadata.

### Manual fallback

If the job fails or is skipped, upload the zip by hand as described below.

## Prerequisites

- A [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/) account
- `dist/jzb-decoder.zip` from `npm run package`
- Screenshots (see [docs/screenshots/README.md](../screenshots/README.md))
- Privacy policy URL: [github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)

## Firefox manifest requirements

`manifest.json` must include:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "jzb-decoder@ravidorr.github.io",
    "data_collection_permissions": {
      "required": ["none"]
    }
  }
}
```

`npm run check-version` and `bash scripts/verify-package.sh` validate these fields.

## Build the upload zip

```bash
npm test
npm run package
bash scripts/verify-package.sh
```

## Test locally before submission

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the repository root
4. Open DevTools and select the **Decipher JZB** panel
5. Open the **Network** tab at least once, then verify auto-capture and theme switching

## Submit to AMO manually

1. Open the [Add-ons Developer Hub](https://addons.mozilla.org/developers/)
2. Click **Submit a New Add-on** (or update an existing listing)
3. Upload `dist/jzb-decoder.zip`
4. Choose **On this site** for a public AMO listing
5. Fill in the listing metadata and upload screenshots
6. Submit for review

## Firefox-specific notes

- Auto-capture via `devtools.network.onRequestFinished` starts only after the user opens the
  **Network** tab at least once in that DevTools session.
- Theme changes use `devtools.panels.onThemeChanged` instead of Chrome's `setThemeChangeHandler`.
- The `browser_specific_settings.gecko.id` must remain stable across releases.

## Version bumps

Before each release:

1. Run `npm run version:patch`, `npm run version:minor`, or `npm run version:major`
2. Update `CHANGELOG.md`
3. Run `npm test` and `npm run package`
4. Commit and tag the release (`v1.2.1`). Merging the pull request submits the new zip to AMO
   automatically; upload it by hand only when using the fallback above
