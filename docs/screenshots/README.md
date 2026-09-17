# Chrome Web Store screenshots

Capture screenshots after loading the unpacked extension and opening the **Decipher JZB** DevTools panel.

## Redact PII before publishing

Screenshots must not include real visitor IDs, session IDs, account IDs, or full request URLs with live `jzb` payloads.

After capturing a screenshot, run:

```bash
npm run redact-screenshot -- path/to/raw-capture.png docs/screenshots/panel-overview.png
```

The script pixelates common PII regions in DevTools panel screenshots:

- Request list paths and URLs
- Visitor metadata value
- Request URL value
- Decoded JSON identifiers (`visitor_id`, `props.visitor`, `tabId`, `frameId`, `sessionId`)

Review the output image before uploading. Add manual redaction if your layout differs or additional fields are visible.

## Recommended shots

1. **Panel overview** (1280x800 or larger)
   - Open a page that emits `jzb=` beacon requests.
   - Open DevTools, select **Decipher JZB**.
   - Capture the request list with one item selected and decoded JSON visible.
   - Save as `panel-overview.png` after redaction.

2. **Paste cURL**
   - Click **Paste cURL**, paste a copied Network request, and decode it.
   - Capture the paste panel and decoded result.
   - Redact and save as `paste-curl.png`.

3. **Filter in use**
   - Capture several captured requests with the search box filtering the list.
   - Redact and save as `search-filter.png`.

## How to capture on macOS

1. Load the extension from the repository root in `chrome://extensions`.
2. Open DevTools on a page with `jzb=` traffic.
3. Resize the DevTools dock so the panel is easy to read.
4. Press `Cmd+Shift+5` and capture the DevTools window or selected region.
5. Run the redaction script for each raw capture.
6. Save redacted PNG files in this directory.

## Store listing notes

- Use at least one screenshot at 1280x800 or 640x400.
- Prefer synthetic or internal test accounts when capturing.
- Replace `panel-overview.png` with your own redacted capture before publishing.
