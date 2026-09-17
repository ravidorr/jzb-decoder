# Chrome Web Store screenshots

Capture screenshots after loading the unpacked extension and opening the **Decipher JZB** DevTools panel.

`panel-overview.png` is a mock layout image for early listing drafts. Replace it with a real DevTools capture before publishing.

## Recommended shots

1. **Panel overview** (1280x800 or larger)
   - Open a page that emits `jzb=` beacon requests.
   - Open DevTools, select **Decipher JZB**.
   - Capture the request list with one item selected and decoded JSON visible.

2. **Paste cURL**
   - Click **Paste cURL**, paste a copied Network request, and decode it.
   - Capture the paste panel and decoded result.

3. **Filter in use**
   - Capture several captured requests with the search box filtering the list.

## How to capture on macOS

1. Load the extension from the repository root in `chrome://extensions`.
2. Open DevTools on a page with `jzb=` traffic.
3. Resize the DevTools dock so the panel is easy to read.
4. Press `Cmd+Shift+5` and capture the DevTools window or selected region.
5. Save PNG files in this directory using these names:
   - `panel-overview.png`
   - `paste-curl.png`
   - `search-filter.png`

## Store listing notes

- Use at least one screenshot at 1280x800 or 640x400.
- Avoid showing real customer data, production account IDs, or private URLs when possible.
- Blur or replace sensitive values before upload if needed.
