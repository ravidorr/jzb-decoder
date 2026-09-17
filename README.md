# JZB Decoder

Chrome DevTools extension that watches network traffic for requests containing a `jzb=` query parameter, decodes the zlib-compressed JSON payload, and shows it in a **Decipher JZB** panel.

## What is `jzb`?

`jzb` is a transport format for compressed JSON embedded in a URL query parameter. Payloads are typically:

1. URL-safe base64
2. zlib-compressed JSON
3. Often an array of analytics or telemetry events

The format is common in analytics beacon URLs (for example Pendo `ptm.gif` requests), but this extension is **format-specific, not product-specific**. It does not depend on any vendor SDK, API, or backend.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root
5. Open DevTools on any page
6. Open the **Decipher JZB** panel from the DevTools tab bar

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
npm run package
```

`npm run package` writes `dist/jzb-decoder.zip` for Chrome Web Store upload.

## Privacy

Decoding happens locally in the browser. The extension does not request host permissions and does not send captured payloads anywhere else. See [PRIVACY.md](PRIVACY.md) for the full privacy policy text used in the store listing.

Treat decoded output as sensitive because payloads may include user or session identifiers.

## Publishing to the Chrome Web Store

### 1. Prepare the listing assets

- Icons are included at `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`
- Add screenshots using the guide in [docs/screenshots/README.md](docs/screenshots/README.md)
- Host `PRIVACY.md` at a public URL (for example GitHub Pages or the repository default branch) and use that URL in the store listing

### 2. Build the upload zip

```bash
npm test
npm run package
```

Verify the zip contains extension runtime files only:

```bash
unzip -l dist/jzb-decoder.zip
```

Expected runtime files:

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
   - Privacy policy URL: public URL for `PRIVACY.md`
5. Upload screenshots from `docs/screenshots/`
6. Submit for review

### 4. Version bumps

Before each release:

1. Bump `version` in `manifest.json`
2. Run `npm test`
3. Run `npm run package`
4. Upload the new zip to the existing store item

## Notes

Chrome does not allow extensions to add items to the native Network right-click menu. The DevTools panel is the supported integration point.
