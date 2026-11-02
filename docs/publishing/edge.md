# Publishing to Microsoft Edge Add-ons

JZB Decoder uses the same Chromium extension package as Chrome. Upload `dist/jzb-decoder.zip` built from this repository.

For Chrome Web Store steps, see [README.md](../../README.md#chrome-web-store).

## Automated publishing

Merging a pull request into `main` submits the new version to
[Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/jzb-decoder/ohnhdckjblabclpemdpnccffjgkdibid)
for certification. The `publish-edge` job in `.github/workflows/publish-stores.yml` does this, next to the
Chrome and Firefox jobs. It runs only when the shared `changes` job finds that the pull request changed shipped
extension files (`scripts/should-publish.mjs`; see [chrome.md](chrome.md#how-it-works)). Docs-only, test-only,
and tooling-only pull requests are skipped.

The job runs `npm ci`, `npm run check-version`, `npm run package`, and `scripts/verify-package.sh`, then
`scripts/publish-edge-addons.mjs`, which uses the
[Publish API v1.1](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api):

1. Uploads `dist/jzb-decoder.zip` to the draft submission and polls until processing finishes.
2. Publishes the draft and polls until the operation finishes.

The Publish API cannot read the store version or submission state, so the store decides whether there is
anything to submit. If the publish call fails with `InProgressSubmission` (a submission is already in review) or
`NoModulesUpdated` (the store already has this package), the script prints a warning and exits successfully, so a
pending review is never replaced. The package has already been uploaded to the draft by then, so the draft can
change even when nothing is submitted. If the upload step itself fails, the job fails. Any other failure also fails
the job and prints the operation details. A failure here does not affect the Chrome or Firefox jobs. A
concurrency group (`edge-addons-publish`) serializes runs. The job checks out the latest `main` rather than the
merge commit of the run that started it, so a delayed run still submits the newest version.

### Required configuration

The job uses the `edge-addons` GitHub environment. Create it under Settings, Environments. To require a manual
approval before each submission, add required reviewers to that environment.

| Name | Kind | Value |
| --- | --- | --- |
| `EDGE_CLIENT_ID` | Environment secret | The Client ID from the Partner Center Publish API page |
| `EDGE_API_KEY` | Environment secret | The API key from the same page |
| `EDGE_PRODUCT_ID` | Environment variable | The product ID (a GUID) of the extension |

The product ID is not the store ID (`ohnhdckjblabclpemdpnccffjgkdibid`). Find it in Partner Center under
**Microsoft Edge** > **Overview**, on the extension overview page, in the **Extension identity** section.

### One-time setup

1. Sign in to [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd) with
   the account that published the extension.
2. Under **Microsoft Edge**, open **Publish API** and click **Enable** for the new experience if it is offered.
3. Click **Create API credentials** and copy the Client ID and API key. Note the key's expiry date: it must be
   renewed and the secret updated before then.
4. Add the values above to the `edge-addons` environment.

### Manual fallback

If the job fails or is skipped, upload the zip by hand in Partner Center as described below.

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

## Create the Edge Add-ons listing manually

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
4. Commit and tag the release (`v1.2.1`). Merging the pull request submits the new zip to Edge automatically;
   upload it by hand only when using the fallback above
