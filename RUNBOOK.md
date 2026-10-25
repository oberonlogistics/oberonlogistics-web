# Oberon Logistics web runbook

Repo: [oberonlogistics/oberonlogistics-web](https://github.com/oberonlogistics/oberonlogistics-web)

Firebase project: `oberonlogistics-web` (Hosting only)

Production:

- https://oberonlogistics.com (canonical)
- https://www.oberonlogistics.com (301 → apex)
- https://oberonlogistics-web.web.app

Lead form backend: the `processFormLead` Cloud Function in a **separate** Firebase project, `oberonlogistics-2a5d9` (URL hardcoded in [`public/js/contactform.js`](public/js/contactform.js)). This runbook does not deploy or roll it back; a Hosting rollback cannot fix a broken backend.

Incident owner: Ollie (PM, Oberon Logistics).

## Deploy

A merge to `main` runs [`.github/workflows/firebase-hosting-merge.yml`](.github/workflows/firebase-hosting-merge.yml). That Action deploys Hosting to the live channel. It does not deploy anything else.

A pull request opened in this repo gets a preview channel from [`.github/workflows/firebase-hosting-pull-request.yml`](.github/workflows/firebase-hosting-pull-request.yml). The workflow skips a pull request whose head branch is on a fork, so fork PRs get no checks and no preview. Push branches to `oberonlogistics/oberonlogistics-web` itself, not to a fork.

Merge check, on the current head SHA:

1. PM sign-off and CTO sign-off on that SHA.
2. CI green on that SHA, including the preview deploy. "No checks reported" is not green.
3. Health check passes against the preview channel URL the Action posts on the PR.

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

Then run the page checks. Paste the whole block: it runs in a child `bash`, so a failure does not close your terminal. It reports every failure and exits non-zero if any check failed. Pass a preview channel URL as the argument to check a PR before merge; with no argument it checks production.

```bash
bash -s -- "${BASE:-}" <<'EOF'
base="${1:-https://oberonlogistics.com}"
fails=0

fail() { echo "FAIL $*" >&2; fails=$((fails + 1)); }

# 200 and the page body contains the needle (the needles are page titles).
check() {
  local url="$1" needle="$2" body code
  body=$(curl -sS --max-time 20 -w '\n%{http_code}' "$url") || { fail "$url curl error"; return; }
  code="${body##*$'\n'}"
  [[ "$code" == "200" ]] || { fail "$url HTTP $code"; return; }
  grep -F -q -- "$needle" <<<"$body" || { fail "$url missing: $needle"; return; }
  echo "OK   $url"
}

# 301 to exactly the expected location.
redirect() {
  local url="$1" want="$2" got
  got=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$url") || { fail "$url curl error"; return; }
  [[ "$got" == "301 $want" ]] || { fail "$url got '$got', want '301 $want'"; return; }
  echo "OK   $url -> $want"
}

check "$base/" "Landstar BCO - Oberon Logistics"
check "$base/jobs.html" "Careers | Oberon Logistics"
check "$base/carriers/" "Oberon Logistics - Carriers"
redirect "$base/carriers" "$base/carriers/"
# Lead form wiring: the handler must still point at the oberonlogistics-2a5d9 backend.
check "$base/js/contactform.js" "oberonlogistics-2a5d9.cloudfunctions.net/api/leads"

if [[ "$base" == "https://oberonlogistics.com" ]]; then
  redirect "https://www.oberonlogistics.com/" "https://oberonlogistics.com/"
  check "https://oberonlogistics-web.web.app/" "Landstar BCO - Oberon Logistics"
fi

# After /jobs/ ships, uncomment and set the shipped job title:
# check "$base/jobs/" "the shipped job title"
# redirect "$base/jobs" "$base/jobs/"

echo "$fails failure(s)"
exit $((fails > 0))
EOF
```

To check a preview: `BASE=https://oberonlogistics-web--pr-N-xxxx.web.app` before pasting the block.

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

Open that branch against `main`. Health-check its preview URL. PM and CTO sign off on the revert head SHA. CI must be green. After the merge, the Hosting Action redeploys. Re-run the health check against production.

### Emergency

Use this only when production is broken and the revert pull request cannot wait.

1. In the Firebase console, roll Hosting for project `oberonlogistics-web` back to the last good release.
2. Run the health check against production right away.
3. Announce a **merge freeze on `main`**. Live now differs from `main`, and any merge to `main` redeploys the bad change.
4. Open the revert pull request above. It must be the next merge to `main`; lift the freeze only after it lands and the health check passes.
