# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is a Firebase-hosted static website for Oberon Logistics, a Landstar BCO specializing in Capacity Operations. The project consists of:

- **Frontend**: Static HTML/CSS/JS in `public/` folder (Bootstrap 5)
- **Backend**: Firebase Cloud Functions in `functions/` folder
- **Hosting**: Firebase Hosting with automatic deployments via GitHub Actions

## Architecture

### Frontend (`public/`)
- `index.html` - Main landing page with lead capture form
- `jobs.html` - Careers page with job inquiry form
- `carriers/index.html` - Carrier FAQ page
- `css/style.css` - Custom styles
- `js/contactform.js` - Form submission handler with duplicate submission prevention

### Backend (`functions/`)
- `index.js` - Contains `processFormLead` HTTPS function that:
  - Validates reCAPTCHA tokens (score threshold: 0.2)
  - Writes leads to Google Sheets (Leads tab)
  - Requires Firebase config secrets: `service_account`, `sheets.id`, `recaptcha.key`

## Common Commands

```bash
# Install dependencies
cd functions && npm install

# Run Firebase emulators (functions only)
cd functions && npm run serve

# Deploy only Cloud Functions
cd functions && npm run deploy

# Deploy hosting
firebase deploy --only hosting

# View function logs
cd functions && npm run logs
```

## Key Implementation Details

- Form uses reCAPTCHA v3 with site key `6LcAKMgbAAAAAI1v-qN1hMhcgiv--3ka-sU5vsaZ`
- Backend URL is hardcoded in contactform.js: `https://us-central1-oberonlogistics-2a5d9.cloudfunctions.net/api/leads`
- Lead form has client-side duplicate submission guard (`contactFormSubmitted` flag)
- Google Sheets appends to range `Leads!A2:F`
- Node.js version: 14 (configured in functions/package.json)

## Critical Constraints

- Never push to `main`. Every change, rollbacks included, goes through a PR.
- Push branches to `oberonlogistics/oberonlogistics-web`, never a fork: fork PRs get no preview and no Bugbot review.
- No manual `firebase deploy`. The merge workflow is the only path to production.
- Nothing under `public/` may hold a secret, service-account key or token.
- General contact forms open `mailto:`/`tel:` links and post nothing; recruiting forms post only to Philo intake (#18). See RUNBOOK.md. Do not add any other backend call without an issue that asks for it.

## Running Tests

There is no unit test suite. The test is the health check in [RUNBOOK.md](RUNBOOK.md#health-check), run against the PR's preview channel URL. A PR that adds a page, route or redirect adds a `check`/`redirect` line for it to that health check in the same PR.

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
4. **Preview healthy.** The Firebase preview comment names the head SHA's short form, and the RUNBOOK health check passes against that preview URL.
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

Merge with `gh pr merge N --squash --delete-branch`. Then run the RUNBOOK health check against production. If it fails, roll back per RUNBOOK.md before doing anything else.

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
