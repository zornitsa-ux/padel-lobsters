#!/usr/bin/env bash
# =============================================================================
#  test-public-access.sh
#
#  Anon-key probe. Confirms that the public slice works for logged-out
#  visitors, and flags anything on the private surface that still leaks.
#
#  Why this test exists: UI gating is separate from data gating. You can
#  hide a page in the client and the data still be readable via the REST
#  API. This script ignores the client entirely and hits Supabase with
#  the anon key the way an attacker with the browser console would.
#
#  Usage:
#    export SUPABASE_URL="https://<project>.supabase.co"
#    export SUPABASE_ANON_KEY="<anon public key>"
#    ./scripts/test-public-access.sh
#
#  Exit code: 0 if all expectations met, 1 if any mismatch.
#
#  Requires: curl, jq.
# =============================================================================

set -u  # do NOT use `set -e` — we want to run every check even if one fails

: "${SUPABASE_URL:?SUPABASE_URL must be set}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY must be set}"

REST="$SUPABASE_URL/rest/v1"
HDR_KEY="apikey: $SUPABASE_ANON_KEY"
HDR_AUTH="Authorization: Bearer $SUPABASE_ANON_KEY"

PASS=0
FAIL=0

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }

# ---------- helper: fetch URL with anon headers, print HTTP status + body ----
fetch() {
  local url="$1"
  curl -s -o /tmp/body.$$ -w "%{http_code}" \
    -H "$HDR_KEY" -H "$HDR_AUTH" "$url"
}

# =============================================================================
# 1. Public surface — MUST work for anon.
# =============================================================================
echo
echo "── public surface (should succeed for anon) ────────────────────────────"

status=$(fetch "$REST/public_tournaments?select=id,name,date,location&limit=5")
body=$(cat /tmp/body.$$)
if [ "$status" = "200" ] && echo "$body" | jq -e 'type == "array"' >/dev/null 2>&1; then
  pass "public_tournaments readable as anon ($status, $(echo "$body" | jq 'length') rows)"
else
  fail "public_tournaments NOT readable as anon (status=$status)"
fi

status=$(fetch "$REST/public_tournament_registration_counts?select=*&limit=5")
body=$(cat /tmp/body.$$)
if [ "$status" = "200" ] && echo "$body" | jq -e 'type == "array"' >/dev/null 2>&1; then
  pass "public_tournament_registration_counts readable as anon ($status)"
else
  fail "public_tournament_registration_counts NOT readable as anon (status=$status)"
fi

# Sanity: the public view must NOT expose PII columns. Ask for a column the
# public view should not have. Supabase/PostgREST returns 400 for unknown cols.
status=$(fetch "$REST/public_tournaments?select=admin_notes&limit=1")
if [ "$status" = "400" ] || [ "$status" = "404" ]; then
  pass "public_tournaments has no PII column 'admin_notes' (status=$status)"
else
  fail "public_tournaments unexpectedly returned status=$status when probing 'admin_notes'"
fi

# =============================================================================
# 2. Private surface — SHOULD reject, or at least never return PII.
#
#    Today the raw tables still have "allow all" policies (Phase 2 of
#    SECURITY-ROLLOUT). That means some of these WILL currently succeed —
#    this script is the forcing function that makes that visible.
# =============================================================================
echo
echo "── private surface (should reject for anon; Phase 2/3 will tighten) ────"

# Case A: reading PIN column from players. Must NOT return 200 with data.
status=$(fetch "$REST/players?select=pin&limit=1")
body=$(cat /tmp/body.$$)
if [ "$status" = "200" ] && echo "$body" | jq -e 'length > 0' >/dev/null 2>&1; then
  fail "players.pin is readable as anon — PII LEAK (Phase 2 must fix)"
elif [ "$status" = "200" ]; then
  pass "players.pin query returned empty array (RLS filtered — acceptable)"
else
  pass "players.pin query rejected (status=$status)"
fi

# Case B: email column on players.
status=$(fetch "$REST/players?select=email&limit=1")
body=$(cat /tmp/body.$$)
if [ "$status" = "200" ] && echo "$body" | jq -e 'length > 0' >/dev/null 2>&1; then
  fail "players.email is readable as anon — PII LEAK (Phase 2 must fix)"
else
  pass "players.email not exposed to anon (status=$status)"
fi

# Case C: admin_pin on settings.
status=$(fetch "$REST/settings?select=admin_pin&limit=1")
body=$(cat /tmp/body.$$)
if [ "$status" = "200" ] && echo "$body" | jq -e 'length > 0' >/dev/null 2>&1; then
  fail "settings.admin_pin readable as anon — CREDENTIAL LEAK (Phase 2 must fix)"
else
  pass "settings.admin_pin not exposed to anon (status=$status)"
fi

# Case D: raw registrations — player_id visible would break count-only promise.
status=$(fetch "$REST/registrations?select=player_id,tournament_id&limit=1")
body=$(cat /tmp/body.$$)
if [ "$status" = "200" ] && echo "$body" | jq -e 'length > 0' >/dev/null 2>&1; then
  fail "registrations.player_id readable as anon (Phase 2 must fix; public view is count-only)"
else
  pass "registrations not exposed to anon (status=$status)"
fi

# Case E: writes as anon must fail. Try a no-op insert.
status=$(curl -s -o /tmp/body.$$ -w "%{http_code}" \
  -X POST \
  -H "$HDR_KEY" -H "$HDR_AUTH" -H "Content-Type: application/json" \
  --data '{"name":"test-anon-insert-should-fail","date":"2099-01-01"}' \
  "$REST/tournaments")
if [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$status" = "400" ]; then
  pass "anon INSERT into tournaments rejected (status=$status)"
else
  fail "anon INSERT into tournaments NOT rejected (status=$status) — WRITE LEAK"
fi

# =============================================================================
#  Summary
# =============================================================================
echo
echo "── summary ─────────────────────────────────────────────────────────────"
echo "  passed: $PASS"
echo "  failed: $FAIL"
rm -f /tmp/body.$$
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
