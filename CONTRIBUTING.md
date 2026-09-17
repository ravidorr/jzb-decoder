# Contributing

Thanks for helping improve JZB Decoder.

## Getting started

1. Fork and clone the repository.
2. Load the extension unpacked from the repository root in `chrome://extensions`.
3. Run tests before opening a pull request:

```bash
npm test
```

## Making changes

- Keep the extension local-only: no host permissions, no remote calls, no backend.
- Prefer minimal dependencies.
- Match the existing code style and file layout.
- Update tests when changing decode logic, cURL parsing, or payload summarization.
- Update `README.md` when user-facing behavior changes.

## Screenshots

If you add or update Chrome Web Store screenshots:

1. Capture from the **Decipher JZB** DevTools panel.
2. Redact PII before committing:

```bash
npm run redact-screenshot -- path/to/raw-capture.png docs/screenshots/output.png
```

3. Review the redacted image before opening a pull request.

## Pull requests

1. Describe the problem and the change.
2. Confirm `npm test` passes.
3. Note any manual Chrome testing you performed.
4. Keep pull requests focused and small when possible.

## Reporting issues

Open a GitHub issue with:

- Chrome version
- Steps to reproduce
- Expected vs actual behavior
- Sample `jzb` payload or cURL text if available (redact visitor/account IDs first)
