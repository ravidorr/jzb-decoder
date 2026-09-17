# Privacy Policy for JZB Decoder

**Last updated:** September 17, 2026

JZB Decoder is a Chrome DevTools extension that decodes `jzb` query-parameter payloads
from network requests you inspect in DevTools.

## Data collection

This extension does **not** collect, store, transmit, or sell personal data.

- No analytics or telemetry are embedded in the extension.
- No accounts, sign-in, or user profiles are used.
- No network requests are made by the extension to external servers.

## How your data is handled

- Decoding happens **locally in your browser** on the machine where Chrome is running.
- The extension watches DevTools network activity only while DevTools is open and only for requests whose URL contains `jzb=`.
- Captured and decoded payloads are kept in DevTools panel memory for the current DevTools session
  and are cleared when you click **Clear** or close DevTools.
- The **Paste cURL** feature decodes text you paste manually; that text is not sent anywhere.

## Permissions

The extension uses Chrome's DevTools APIs only. It does **not** request host permissions or broad site access.

## Sensitive information

Decoded `jzb` payloads may contain identifiers such as visitor IDs, account IDs, URLs,
or event properties from the sites you inspect.
Treat decoded output as sensitive and share it only with people and systems you trust.

## Changes

If this policy changes, the updated text will be published in the extension repository
and reflected in the Chrome Web Store listing.

## Contact

For privacy questions, open an issue at
[github.com/ravidorr/jzb-decoder/issues](https://github.com/ravidorr/jzb-decoder/issues)
or contact the maintainer listed on the Chrome Web Store listing.
