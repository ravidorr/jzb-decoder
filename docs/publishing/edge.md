# Publishing to Microsoft Edge Add-ons

JZB Decoder uses the same Chromium extension package as Chrome. Upload `dist/jzb-decoder.zip` built from this repository.

For Chrome Web Store steps, see [README.md](../../README.md#chrome-web-store).

## Prerequisites

- A [Microsoft Partner Center](https://partner.microsoft.com/) account (free)
- `dist/jzb-decoder.zip` from `npm run package`
- Store assets:
  - 300x300 store logo
  - At least one 1280x800 screenshot (see [docs/screenshots/README.md](../screenshots/README.md))
- Privacy policy URL: [github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)

## Build the upload zip

```bash
npm test
npm run package
bash scripts/verify-package.sh
```

## Create the Edge Add-ons listing

1. Open [Partner Center](https://partner.microsoft.com/dashboard) and go to **Microsoft Edge** > **Extensions**.
2. Click **Create new extension**.
3. Upload `dist/jzb-decoder.zip`.
4. Fill in the listing:
   - Name: `JZB Decoder`
   - Summary: decode `jzb` payloads from DevTools network traffic
   - Category: Developer Tools
   - Privacy policy URL: [github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)
5. Upload the 300x300 logo and at least one 1280x800 screenshot.
6. Submit for certification.

## Listing tips

- Avoid referring to "Chrome" in the Edge listing description.
- Edge assigns its own extension ID; this is expected and does not affect functionality.
- Test locally first via `edge://extensions` > **Developer mode** > **Load unpacked**.

## Version bumps

Before each release:

1. Run `npm run version:patch`, `npm run version:minor`, or `npm run version:major`
2. Update `CHANGELOG.md`
3. Run `npm test` and `npm run package`
4. Commit, tag the release (`v1.2.1`), and upload the new zip to the Edge listing
