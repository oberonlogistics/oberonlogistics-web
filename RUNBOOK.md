# Oberon Logistics web runbook

Repo: [oberonlogistics/oberonlogistics-web](https://github.com/oberonlogistics/oberonlogistics-web)

Firebase project: `oberonlogistics-web` (Hosting only)

Production:

- https://oberonlogistics.com (canonical)
- https://www.oberonlogistics.com (301 → apex)
- https://oberonlogistics-web.web.app

Lead forms:

- General contact (home page, `/carriers/`): no backend. [`public/js/contactform.js`](public/js/contactform.js) opens a `mailto:` draft to info@ plus a `tel:` link; nothing is posted (Pass A of #3).
- Recruiting (the application on each `/jobs/<slug>/` posting and the Careers form on `/jobs.html`): [`public/js/driverleadform.js`](public/js/driverleadform.js) posts JSON to `INTAKE_URL`, the Philo intake form of funnel "CDL-A Company Driver" (#18). The body is one flat object: Philo maps `name`, `email` and `phone` to the lead's contact columns and keeps every other key (the answers and `source_form`) in the lead's `fields`. Only a 2xx answer shows a thank-you. `LEADS_ENABLED = false` in that file turns both forms back into local validation with nothing sent. The form key is a public routing ID, not a credential; if it is abused, rotate it in Philo and update the constant. The old `processFormLead` Cloud Function in project `oberonlogistics-2a5d9` is dead (404) and out of scope for this runbook.

Incident owner: Ollie (PM, Oberon Logistics).

## Deploy

A merge to `main` runs [`.github/workflows/firebase-hosting-merge.yml`](.github/workflows/firebase-hosting-merge.yml). That Action deploys Hosting to the live channel. It does not deploy anything else.

A pull request opened in this repo gets a preview channel from [`.github/workflows/firebase-hosting-pull-request.yml`](.github/workflows/firebase-hosting-pull-request.yml). The workflow skips a pull request whose head branch is on a fork, so fork PRs get no checks and no preview. Push branches to `oberonlogistics/oberonlogistics-web` itself, not to a fork.

Merge check: the [Shippability Bar in CLAUDE.md](CLAUDE.md#shippability-bar), on the current head SHA. In short: CI green including the preview deploy ("no checks reported" is not green), Bugbot `APPROVED` on that SHA, and the health check below passing against the preview channel URL the Action posts on the PR. A PR that meets it is merged by its author; a PR on the bar's escalation list also needs PM and CTO sign-off on that SHA.

No manual `firebase deploy`.

## Health check

After a merge, confirm `firebase-hosting-merge.yml` finished with `success` for the merged commit. `--commit` needs the full 40-character SHA; a short SHA returns an empty list.

```bash
SHA=$(git rev-parse origin/main)
gh run list \
  --repo oberonlogistics/oberonlogistics-web \
  --workflow firebase-hosting-merge.yml \
  --commit "$SHA" \
  --json status,conclusion,url
```

Wait until `status` is `completed` and `conclusion` is `success` (or use `gh run watch <run-id>`).

The merge workflow runs the page checks against production right after the deploy, so `success` means the deploy finished and every check passed. The PR workflow runs the same checks against each PR's preview channel in `build_and_preview`.

The checks live in [`scripts/health-check.sh`](scripts/health-check.sh). It reports every failure and exits non-zero if any check failed. To run it by hand from a checkout, with no argument it checks production; pass a preview channel URL to check a preview:

```bash
bash scripts/health-check.sh
bash scripts/health-check.sh https://oberonlogistics-web--pr-N-xxxx.web.app
```

To check a PR's preview by hand, run that PR's own copy so its new checks run too:

```bash
git fetch origin pull/N/head
git show FETCH_HEAD:scripts/health-check.sh | bash -s -- https://oberonlogistics-web--pr-N-xxxx.web.app
```

A cloud Claude Code session can't run it unless its environment allows `*.web.app`, `oberonlogistics.com`, `www.oberonlogistics.com` and `philo.oberonlogistics.com`; the default Trusted network level blocks them. Rely on the CI step instead.

## Rollback

### Standard

Open a revert pull request and send it through the merge check. Never push directly to `main`.

These commands assume `origin` is `oberonlogistics/oberonlogistics-web`. If your `origin` is a fork, use the remote that points at the canonical repo instead, and push the branch there so the PR gets CI and a preview.

```bash
git fetch origin
git switch -c revert/hosting-SHA origin/main
git revert --no-edit SHA
# merge commit:
# git revert --no-edit -m 1 MERGE_SHA
git push -u origin HEAD
```

Open that branch against `main`. It goes through the same merge check as any PR: CI green, Bugbot approval and a passing health check on its preview URL, all on the revert head SHA. After the merge, the Hosting Action redeploys. Re-run the health check against production.

### Emergency

Use this only when production is broken and the revert pull request cannot wait.

1. In the Firebase console, roll Hosting for project `oberonlogistics-web` back to the last good release.
2. Run the health check against production right away.
3. Announce a **merge freeze on `main`**. Live now differs from `main`, and any merge to `main` redeploys the bad change.
4. Open the revert pull request above. It must be the next merge to `main`; lift the freeze only after it lands and the health check passes.
