# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ESLint for JavaScript, Stylelint for CSS, markdownlint for Markdown, and html-validate for HTML
- Version sync check, bump scripts, and pre-commit hook
- CI checks for version sync, lint, tests, and packaging

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
