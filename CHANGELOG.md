# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.4] - 2026-09-17

### Added

- Size limits on `jzb` base64, compressed, and decompressed payloads, plus pasted cURL text
- `isCapturedItem` validation for devtools/panel port messages

### Fixed

- `highlightJson` uses a fixed CSS class map instead of dynamic class names from key strings

## [1.1.3] - 2026-09-17

### Fixed

- New captures stay selected in the detail pane when a filter would hide them from the list
- Clear list ignores in-flight decodes that finish after the user clears captures
- Paste cURL uses the URL that actually contains `jzb=` for request metadata
- Live captures appear newest-first in the panel list

## [1.1.2] - 2026-09-17

### Changed

- Simplified panel list rendering, paste UI helpers, and sidebar layout utilities
- Consolidated network capture decode flow in `devtools.js` via `buildItemFromJzb`
- Streamlined `highlightJson` and curl parameter parsing in `jzb.js`

## [1.1.1] - 2026-09-17

### Changed

- Consolidated captured-item helpers (`buildErrorCapturedItem`, trim, `formatError`, `formatTimestamp`) in `jzb.js`
- Panel avoids redundant list/detail re-renders on capture, selection, and filter
- `highlightJson` key regex derived from a single key set

### Fixed

- Skip URL parsing for network requests that do not contain `jzb=`
- Avoid double curl text normalization when extracting URLs

## [1.1.0] - 2026-09-17

### Added

- DevTools light/dark theme support via `chrome.devtools.panels.themeName`
- Resizable sidebar column in the Decipher JZB panel
- Paste hint when clipboard auto-paste is unavailable in DevTools
- `matchesCapturedRequestSearch` helper and shared `MAX_CAPTURED_REQUESTS` constant
- Tests for `decodeJzb`, zlib-wrapper fallback, `highlightJson` HTML escaping, and search matching

### Changed

- Panel UX: filter and Clear list in sidebar, Clear cURL control, full URL display in list
- Paste cURL uses `execCommand` for clipboard access in DevTools panels
- Decode errors and panel `postMessage` failures are handled separately in devtools

### Fixed

- Base64url padding for `jzb` parameters whose length mod 4 is 2
- 200-request cap enforced consistently in devtools and panel on all capture paths
- Filter hides selected item: detail view now syncs to first visible match
- Port disconnect shows a connection-lost message instead of failing silently
- Paste cURL decoding via `buildCapturedItem` with correct arguments

## [1.0.0] - 2026-09-17

### Added

- Chrome DevTools extension that watches finished network requests for `jzb=` query parameters
- **Decipher JZB** DevTools panel with request list and decoded payload detail view
- URL-safe base64 + zlib + JSON decode pipeline with zlib-wrapper fallback
- Auto-capture of matching network requests (up to 200 per DevTools session)
- Request search/filter by label, URL, method, and common event fields
- Copy decoded JSON to clipboard
- Syntax highlighting for key JSON fields (`type`, `track_event_name`, `visitor_id`, `account_id`, `props`)
- **Paste cURL** flow for manually decoding copied Network requests
- Hardened cURL parsing for quoted URLs, `--url`, multiline commands, and multiple URLs
- Icons at 16, 48, and 128 px for Chrome Web Store listing
- `PRIVACY.md` for local-only processing and store privacy policy URL
- Packaging via `npm run package` to `dist/jzb-decoder/` and `dist/jzb-decoder.zip`
- Screenshot redaction script for store assets (`npm run redact-screenshot`)
- Redacted `docs/screenshots/panel-overview.png` for store listing
- Node tests for decode, cURL extraction, and JSON highlighting
- GitHub Actions CI for tests, packaging, and package verification
- MIT `LICENSE`, `CONTRIBUTING.md`, and repository metadata in `package.json`
- GitHub release `v1.0.0` with attached `jzb-decoder.zip`

### Notes

- Chrome does not allow adding items to the native Network right-click menu;
  the DevTools panel is the supported integration point
- `manifest.json` is the canonical extension version; `package.json` mirrors it for development tooling
