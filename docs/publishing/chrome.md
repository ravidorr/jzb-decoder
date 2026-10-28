# Automated Chrome Web Store publishing

Merging a pull request into `main` can submit the extension to the Chrome Web Store for review.
`.github/workflows/publish-chrome-web-store.yml` does this. Pull requests closed without merging do nothing,
and the regular CI workflow is unchanged.

For the manual first-time listing steps, see the Chrome Web Store section of
[README.md](../../README.md#chrome-web-store).

## How it works

1. The `changes` job checks which files the merged pull request touched
   (`scripts/should-publish.mjs`). It publishes only when the pull request changed a file that ships in the
   extension zip: `jzb.js`, `panel.*`, `devtools.*`, `icons/`, or `design-system/`. A change to `manifest.json`
   counts only when it changes more than the `version` field. Docs-only, test-only, and tooling-only pull
   requests are skipped with a notice and do not fail the workflow.
2. The `publish` job checks out the merged code and runs `npm ci`, `npm run check-version`, and
   `npm run package`, then verifies the package contents with `scripts/verify-package.sh`.
3. It authenticates to Google Cloud with GitHub Actions OIDC and Workload Identity Federation. No long-lived
   credentials are stored.
4. `scripts/check-chrome-web-store-version.mjs` compares the manifest version with the highest published or
   submitted version in the store. If the manifest version is not higher, the remaining steps are skipped with a
   notice. This runs before any cancel step, so a pending review is never cancelled for an unchanged version.
5. A previous submission in `PENDING_REVIEW` or `STAGED` is cancelled. The known states `PUBLISHED`,
   `PUBLISHED_TO_TESTERS`, `REJECTED`, and `CANCELLED` pass through. Any other state fails the run.
6. `dist/jzb-decoder.zip` is uploaded and the workflow polls until processing finishes (up to five minutes).
7. The upload is submitted with default publishing and review enabled (`publishType: DEFAULT_PUBLISH`,
   `skipReview: false`, `blockOnWarnings: true`).

The `publish` job has only `contents: read` and `id-token: write` permissions. A concurrency group serializes
submissions. If several merges queue up while a run is in progress, GitHub keeps only the newest pending run.
That is intended: the last run builds the latest `main`, which includes the earlier changes and the highest
version. API error bodies are printed in the workflow logs.

Every pull request must bump the version (see [CONTRIBUTING.md](../../CONTRIBUTING.md#versioning)). A pull
request that only changes documentation bumps the version but is not submitted to the store, so the store version
can trail `manifest.json`. The next pull request that changes the extension submits the current version.

## Required repository variables

Set these under Settings, Secrets and variables, Actions, Variables. Use repository variables, not environment
variables: the workflow reads `vars.*` without declaring an `environment:`.

| Variable | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Provider resource name: `projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>` |
| `GCP_SERVICE_ACCOUNT` | Service account email: `<name>@<project>.iam.gserviceaccount.com` |
| `CWS_EXTENSION_ID` | The extension ID from the Chrome Web Store developer dashboard |
| `CWS_PUBLISHER_ID` | The publisher ID, the first ID in the developer dashboard URL |

## Google Cloud setup

1. Enable the Chrome Web Store API in the Google Cloud project.
2. Create a service account for publishing, or reuse the one already authorized for your publisher.
3. Create a Workload Identity pool and an OIDC provider with issuer `https://token.actions.githubusercontent.com`.
   Map `google.subject=assertion.sub` and `attribute.repository=assertion.repository`, and add the attribute
   condition `assertion.repository == 'ravidorr/jzb-decoder'`.
4. Grant the principal set for this repository the `roles/iam.workloadIdentityUser` role on the service account:

   ```text
   principalSet://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/<pool>/attribute.repository/ravidorr/jzb-decoder
   ```

IAM changes can take up to five minutes to apply.

## Chrome Web Store setup

1. In the [developer dashboard](https://chrome.google.com/webstore/devconsole), open Settings and check the
   service account section. A publisher can have only one service account. If one is already set, reuse it: add
   a provider for this repository to its Workload Identity pool and bind this repository to that service account.
   Never replace it, because other repositories that publish through it would stop working.
2. Copy the extension ID and publisher ID into the repository variables above.

## First run

The first run happens on the first merged pull request that changes a shipped file. Check its logs for:

- `Publishing <version> (store has: <version>)` from the version step
- `"state": "PENDING_REVIEW"` in the submit step

## Troubleshooting

- Authentication fails: the provider path or the repository attribute condition is wrong, or IAM has not
  propagated yet.
- `fetchStatus failed (403)`: the service account is not authorized for the publisher, or the Chrome Web Store
  API is not enabled.
- `Unexpected Chrome Web Store submitted revision state`: the store reported a state the workflow does not
  handle. Check the printed status JSON in the logs and resolve it in the dashboard.
- `Skipping Chrome Web Store publish`: the manifest version is not higher than the store's. Bump the version and
  merge a pull request that changes the extension.
- Upload fails: the printed response includes the store's error details.
