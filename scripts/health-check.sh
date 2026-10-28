#!/usr/bin/env bash
# RUNBOOK.md#health-check. Usage: scripts/health-check.sh [base-url]  (default: production)
base="${1:-https://oberonlogistics.com}"
base="${base%/}"
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
check "$base/" 'href="/favicon.ico"'
redirect "$base/carriers" "$base/carriers/"
# Lead form handler: mailto hand-off, no call to the dead Cloud Function.
check "$base/js/contactform.js" "info@oberonlogistics.com" "cloudfunctions.net"
# Recruiting forms: Philo intake handler, loaded by the Careers page.
check "$base/js/driverleadform.js" "philo.oberonlogistics.com/api/intake/"
check "$base/js/theme.js" "data-theme-choice"
check "$base/" "js/theme.js"
check "$base/jobs.html" "js/theme.js"
check "$base/carriers/" "js/theme.js"
check "$base/jobs/" "js/theme.js"
check "$base/jobs/cdl-a-dedicated-regional-atlanta/" "js/theme.js"
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
