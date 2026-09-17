# Publishing to Firefox AMO

JZB Decoder ships as a Manifest V3 WebExtension. Upload `dist/jzb-decoder.zip` built from this repository.

For Chrome Web Store steps, see [README.md](../../README.md#chrome-web-store).

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

## Submit to AMO

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
4. Commit, tag the release (`v1.2.1`), and upload the new zip to AMO
