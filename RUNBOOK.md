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

Then run the page checks. Paste the whole block: it runs in a child `bash`, so a failure does not close your terminal. It reports every failure and exits non-zero if any check failed. As written it checks production. To check a PR preview before merge, put the preview channel URL after `--` on the first line (e.g. `bash -s -- https://oberonlogistics-web--pr-N-xxxx.web.app <<'EOF'`). It never reads `BASE` or any other variable from your shell.

```bash
bash -s -- <<'EOF'
base="${1:-https://oberonlogistics.com}"
fails=0

fail() { echo "FAIL $*" >&2; fails=$((fails + 1)); }

# 200, the body contains the needle, and (if given) does not contain the forbidden string.
check() {
  local url="$1" needle="$2" forbidden="${3:-}" body code
  body=$(curl -sS --max-time 20 -w '\n%{http_code}' "$url") || { fail "$url curl error"; return; }
  code="${body##*$'\n'}"
  [[ "$code" == "200" ]] || { fail "$url HTTP $code"; return; }
  grep -F -q -- "$needle" <<<"$body" || { fail "$url missing: $needle"; return; }
  [[ -z "$forbidden" ]] || ! grep -F -q -- "$forbidden" <<<"$body" || { fail "$url contains: $forbidden"; return; }
  echo "OK   $url"
}

# 301 to exactly the expected location.
redirect() {
  local url="$1" want="$2" got
  got=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$url") || { fail "$url curl error"; return; }
  [[ "$got" == "301 $want" ]] || { fail "$url got '$got', want '301 $want'"; return; }
  echo "OK   $url -> $want"
}

# Philo answers a CORS preflight from this origin for the intake URL the deployed JS posts to.
intake_preflight() {
  local js url headers
  js=$(curl -sS --max-time 20 "$base/js/driverleadform.js") || { fail "intake JS curl error"; return; }
  url=$(grep -o 'https://philo.oberonlogistics.com/api/intake/[0-9a-f]*' <<<"$js" | head -n 1)
  [[ -n "$url" ]] || { fail "driverleadform.js has no Philo intake URL"; return; }
  headers=$(curl -sS --max-time 20 -o /dev/null -D - -X OPTIONS \
    -H "Origin: $base" -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" "$url" | tr -d '\r') || { fail "intake preflight curl error"; return; }
  grep -q '^HTTP/[0-9.]* 204' <<<"$headers" || { fail "intake preflight not 204"; return; }
  grep -qix "access-control-allow-origin: $base" <<<"$headers" || { fail "intake preflight does not allow $base"; return; }
  echo "OK   Philo intake preflight from $base"
}

check "$base/" "Landstar BCO - Oberon Logistics"
check "$base/jobs.html" "Careers | Oberon Logistics"
check "$base/carriers/" "Oberon Logistics - Carriers"
redirect "$base/carriers" "$base/carriers/"
# Lead form handler: mailto hand-off, no call to the dead Cloud Function.
check "$base/js/contactform.js" "info@oberonlogistics.com" "cloudfunctions.net"
# Recruiting forms: Philo intake handler, loaded by the Careers page.
check "$base/js/driverleadform.js" "philo.oberonlogistics.com/api/intake/"
check "$base/jobs.html" "driverleadform.js"
intake_preflight

if [[ "$base" == "https://oberonlogistics.com" ]]; then
  redirect "https://www.oberonlogistics.com/" "https://oberonlogistics.com/"
  check "https://oberonlogistics-web.web.app/" "Landstar BCO - Oberon Logistics"
fi

check "$base/jobs.html" "./jobs/cdl-a-dedicated-regional-atlanta/"
check "$base/jobs/" "Open Positions | Oberon Logistics"
redirect "$base/jobs" "$base/jobs/"
check "$base/jobs/cdl-a-dedicated-regional-atlanta/" "CDL-A Company Driver: Dedicated Regional out of Atlanta"
check "$base/jobs/cdl-a-dedicated-regional-atlanta/" "driverleadform.js"
check "$base/jobs/cdl-a-dedicated-regional-atlanta/" 'id="apply"' "Apply on this page"
redirect "$base/jobs/cdl-a-dedicated-regional-atlanta" "$base/jobs/cdl-a-dedicated-regional-atlanta/"

echo "$fails failure(s)"
exit $((fails > 0))
EOF
```

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
