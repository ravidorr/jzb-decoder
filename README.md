# JZB Decoder

DevTools extension for Chrome, Edge, and Firefox that watches network traffic for requests containing a `jzb=` query parameter,
decodes the zlib-compressed JSON payload, and shows it in a **Decipher JZB** panel.

- Repository: [github.com/ravidorr/jzb-decoder](https://github.com/ravidorr/jzb-decoder)
- Privacy policy: [github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- License: [MIT](LICENSE)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## What is `jzb`?

`jzb` is a transport format for compressed JSON embedded in a URL query parameter. Payloads are typically:

1. URL-safe base64
2. zlib-compressed JSON
3. Often an array of analytics or telemetry events

The format is common in analytics beacon URLs (for example Pendo `ptm.gif` requests),
but this extension is **format-specific, not product-specific**.
It does not depend on any vendor SDK, API, or backend.

## Install

### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root
5. Open DevTools on any page
6. Open the **Decipher JZB** panel from the DevTools tab bar

### Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root
5. Open DevTools on any page
6. Open the **Decipher JZB** panel from the DevTools tab bar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from this repository root
4. Open DevTools on any page
5. Open the **Decipher JZB** panel from the DevTools tab bar

On Firefox, open the **Network** tab at least once per DevTools session before auto-capture starts.

## Features

- Auto-captures finished network requests whose URL contains `jzb=`
- Decodes URL-safe base64 + zlib + JSON
- Lists captured requests with event name / type when present in the payload
- Search/filter captured requests by label, URL, method, and common event fields
- Shows pretty-printed JSON with highlighted key fields
- Copy decoded JSON to the clipboard
- Supports **Paste cURL** for requests copied from the Network tab

## Development

```bash
npm test
npm run lint          # js, css, md, html
npm run check-version
npm run package
npm run install-hooks
```

Install git hooks once per clone so commits verify `manifest.json` and `package.json` versions stay in sync.

### Version bumps

`manifest.json` is the canonical extension version. Bump both files together:

```bash
npm run version:patch
# or: npm run version:minor
# or: npm run version:major
```

Update `CHANGELOG.md`, then commit, tag (`v1.0.1`), package, and publish.

`npm run package` writes:

- `dist/jzb-decoder/` unpacked extension files for inspection
- `dist/jzb-decoder.zip` for Chrome Web Store, Microsoft Edge Add-ons, and Firefox AMO upload

## Privacy

Decoding happens locally in the browser.
The extension does not request host permissions and does not send captured payloads anywhere else.
See [PRIVACY.md](PRIVACY.md) or the
[hosted copy on GitHub](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)
for the store listing privacy policy URL.

Treat decoded output as sensitive because payloads may include user or session identifiers.

## Publishing

Store-specific submission steps:

- Chrome Web Store: see below
- Microsoft Edge Add-ons: [docs/publishing/edge.md](docs/publishing/edge.md)
- Firefox AMO: [docs/publishing/firefox.md](docs/publishing/firefox.md)

### Chrome Web Store

### 1. Prepare the listing assets

- Icons are included at `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`
- Add screenshots using the guide in [docs/screenshots/README.md](docs/screenshots/README.md)
- Use the hosted privacy policy URL: [github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)

### 2. Build the upload zip

```bash
npm test
npm run package
```

Verify the packaged output:

```bash
ls dist/jzb-decoder
unzip -l dist/jzb-decoder.zip
```

Expected runtime files in `dist/jzb-decoder/` and at the zip root:

- `manifest.json`
- `devtools.html`, `devtools.js`
- `jzb.js`
- `panel.html`, `panel.js`, `panel.css`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

### 3. Create the Chrome Web Store item

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Create a new item
3. Upload `dist/jzb-decoder.zip`
4. Fill in the listing:
   - Name: `JZB Decoder`
   - Summary: decode `jzb` payloads from DevTools network traffic
   - Category: Developer Tools
   - Privacy policy URL: [github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md](https://github.com/ravidorr/jzb-decoder/blob/main/PRIVACY.md)
5. Upload screenshots from `docs/screenshots/`
6. Submit for review

### 4. Version bumps

Before each release:

1. Run `npm run version:patch`, `npm run version:minor`, or `npm run version:major`
2. Update `CHANGELOG.md`
3. Run `npm test` and `npm run package`
4. Commit, tag the release (`v1.0.1`), and upload the new zip to the store item

## Notes

Chromium-based browsers do not allow extensions to add items to the native Network right-click menu.
The DevTools panel is the supported integration point.
