# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is a static website for Oberon Logistics, a Landstar BCO specializing in Capacity Operations, served by Firebase Hosting in project `oberonlogistics-web`. Production, deploys and rollback are in [RUNBOOK.md](RUNBOOK.md).

- **Site**: Static HTML/CSS/JS in `public/` (Bootstrap 5 from a CDN). No build step.
- **Backend**: None live. `functions/` is legacy (see below). Recruiting forms post to Philo intake, an outside service; general contact forms post nothing.
- **Hosting**: Deployed only by GitHub Actions. A PR gets a preview channel; a merge to `main` deploys the live channel.

## Architecture

### Site (`public/`)
- `index.html` - Home page with the general contact form
- `carriers/index.html` - Carrier FAQ page with the general contact form
- `jobs.html` - Careers page with the recruiting form
- `jobs/index.html` - List of open positions
- `jobs/<slug>/index.html` - One page per job posting, each with the recruiting application (currently `cdl-a-dedicated-regional-atlanta/`)
- `404.html` - Not-found page
- `robots.txt`, `sitemap.xml`, `llms.txt`, `.well-known/indexnow.txt` - Crawler and AI-search files
- `css/style.css` - Custom styles
- `js/contactform.js` - General contact handler: opens a `mailto:` draft to info@ and offers a `tel:` link
- `js/driverleadform.js` - Recruiting handler: posts JSON to Philo intake (`INTAKE_URL`); `LEADS_ENABLED = false` turns sending off
- `js/jumbo-video.js` - Hero video crossfade on the home and Careers pages
- `img/` - Images and hero videos

### Legacy (`functions/`)
- Holds the old `processFormLead` Cloud Function (reCAPTCHA, Google Sheets, Node 14). It belonged to the other project, `oberonlogistics-2a5d9`, and is dead (404). Nothing on the site calls it and no workflow deploys it.
- Out of scope: do not run, deploy or extend it. Any change to `functions/`, including deleting it, is on the escalation list below.

## Common Commands

```bash
# Preview a PR: push a branch to oberonlogistics/oberonlogistics-web and open a PR.
# The PR workflow posts the preview channel URL as a comment.

# Test: build_and_preview runs the RUNBOOK health check (scripts/health-check.sh) against that preview URL.
# See RUNBOOK.md#health-check.

# Check a PR against the Shippability Bar: see the gh command under Shippability Bar below.

# Deploy: merge the PR. firebase-hosting-merge.yml deploys Hosting to the live channel.
```

## Key Implementation Details

- Lead destinations: general contact goes to `info@oberonlogistics.com` and the `tel:` number in `public/js/contactform.js`; recruiting goes to the Philo intake URL in `public/js/driverleadform.js` (funnel "CDL-A Company Driver"). The Philo form key is a public routing ID, not a credential.
- Recruiting shows a thank-you only on a 2xx answer from Philo. The health check also confirms Philo answers a CORS preflight from the site's origin.
- The form scripts are loaded with a `?v=N` query string; bump it on every page that loads the script when you change its behavior.
- The merge and PR workflows deploy Hosting only. The `database` block in `firebase.json` and `database.rules.json` are not deployed by them.

## Critical Constraints

- Never push to `main`. Every change, rollbacks included, goes through a PR.
- Push branches to `oberonlogistics/oberonlogistics-web`, never a fork: fork PRs get no preview and no Bugbot review.
- No manual `firebase deploy`. The merge workflow is the only path to production.
- Nothing under `public/` may hold a secret, service-account key or token.
- General contact forms open `mailto:`/`tel:` links and post nothing; recruiting forms post only to Philo intake (#18). See RUNBOOK.md. Do not add any other backend call without an issue that asks for it.

## Running Tests

There is no unit test suite. The test is the health check in [`scripts/health-check.sh`](scripts/health-check.sh) (see [RUNBOOK.md](RUNBOOK.md#health-check)). `build_and_preview` runs it against the PR's preview channel URL, and the merge workflow runs it against production after each deploy. A PR that adds a page, route or redirect adds a `check`/`redirect` line for it to that script in the same PR.

## Triage Rules

Classify every finding, from self-review, an Opus pass or Bugbot:

- **blocker**: a broken page, route, redirect or asset; a lead form that stops working or sends to the wrong address; a security issue (secret in `public/`, XSS, weakened workflow permissions); invalid SEO markup (bad JSON-LD, wrong canonical, robots blocking the site); a gate or doc that reports green when nothing was checked. Bugbot's **Blocking** label is a blocker.
- **significant**: a real defect on an edge path (one browser, one viewport, a missing `alt`, a slow asset) or a convention in this file broken. Fix it in the PR.
- **nit**: wording, style, naming, optional refactors. Not fixed, not filed as an issue. Mention in the PR's `## Notes` only if it is a pattern.

## Shippability Bar

A PR is shippable, and its author (human or agent) merges it without further sign-off, when **all** of these hold on the PR's **current head SHA**. Anything checked on an older SHA does not count; a new push starts over.

1. **Not escalated.** The PR touches nothing on the escalation list below.
2. **CI green.** `build_and_preview`, `Deploy Preview` and Bugbot's `review` each completed with `SUCCESS` on the head SHA; pending, skipped or missing is not green, and "no checks reported" is not green. No other check failed. The `claude` check reports `SKIPPED` on any PR that does not mention `@claude`; that is expected.
3. **Bugbot approved.** The latest review from `ergofobe-bot` is `APPROVED` and its commit is the head SHA. A `CHANGES_REQUESTED` is cleared only by pushing a fix and getting a fresh `APPROVED`, never by dismissing it. The PR must not be opened by `ergofobe-bot`: GitHub does not let it approve its own PR, so Bugbot only posts a comment-form verdict there and this item can never be met. Close such a PR and open a new one for the same branch from another account, such as `ergofobe`; reopening keeps the original author.
4. **Preview healthy.** The Firebase preview comment names the head SHA's short form, and the RUNBOOK health check (`scripts/health-check.sh`) passed against that preview URL. `build_and_preview` runs it right after deploying the preview, so its `SUCCESS` on the head SHA (item 2) covers this item; no hand run is needed. Weakening that script or that workflow step is loosening the RUNBOOK health check (escalation list).
5. **Triage clean.** Zero blockers and zero significants open from self-review and any Opus pass. Bugbot Non-blocking notes do not hold a merge.
6. **Ready.** The PR is not a draft and has no merge conflict with `main`.

Check 2–4 from the CLI (`N` is the PR number):

```bash
gh pr view N --repo oberonlogistics/oberonlogistics-web \
  --json author,headRefOid,isDraft,mergeable,statusCheckRollup,reviews,comments \
  --jq '{author: .author.login, head: .headRefOid, isDraft, mergeable,
         checks: [.statusCheckRollup[] | {name, status, conclusion}],
         bugbot: ([.reviews[] | select(.author.login == "ergofobe-bot")] | last | {state, commit: .commit.oid}),
         preview: ([.comments[] | select(.author.login == "github-actions") | .body] | last)}'
```

Merge with `gh pr merge N --squash --delete-branch`. Then confirm `firebase-hosting-merge.yml` succeeded for the merge commit ([RUNBOOK.md](RUNBOOK.md#health-check)); it runs the health check against production after the deploy. If it fails, roll back per RUNBOOK.md before doing anything else.

### Escalation list

These need PM and CTO sign-off on the head SHA in addition to the bar. Leave the PR open and say why:

- `.github/workflows/**`. Bugbot runs from `main`, so it cannot judge a change to its own gate, and these files hold the deploy and bot tokens.
- This Shippability Bar, the Triage Rules, or the RUNBOOK's merge check, health check or rollback steps (removing or loosening a check; adding one is fine).
- `.firebaserc`, `database.rules.json`, `functions/`, or anything that deploys beyond Hosting.
- Lead destinations: the email addresses or phone numbers in `public/js/contactform.js` or the page markup.
- Business claims in page copy: pay, rates, benefits, job requirements, legal or compliance language, and how the Landstar relationship is described.
- A blocker still open after two Opus review iterations.

## User Preferences

- When creating commits, use Co-Authored-By with the current model name (e.g., "Co-Authored-By: Claude with grok-code-fast-1" or "Co-Authored-By: Claude with minimax-m2.5")
