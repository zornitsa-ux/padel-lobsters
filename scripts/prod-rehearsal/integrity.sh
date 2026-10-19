#!/usr/bin/env bash
# Run the auth integrity check (PLAN.md §4.5) against the local stack or, read
# only, against production.
#
#   scripts/prod-rehearsal/integrity.sh --local              counts
#   scripts/prod-rehearsal/integrity.sh --linked             counts, production
#   scripts/prod-rehearsal/integrity.sh --local --details    plus names (keep out of PRs)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase_cli="$here/../../node_modules/.bin/supabase"

target=""
details=false
for arg in "$@"; do
  case "$arg" in
    --local | --linked) target="$arg" ;;
    --details) details=true ;;
    *) echo "usage: $0 --local|--linked [--details]" >&2 && exit 2 ;;
  esac
done
[[ -n "$target" ]] || { echo "usage: $0 --local|--linked [--details]" >&2 && exit 2; }

# Same extraction as dump-function-grants.sh: survives the CLI changing how it
# wraps rows in its JSON output.
rows() {
  "$supabase_cli" db query "$target" --output-format json -f "$1" |
    jq -c '[.. | objects | select(has("check_name") or has("kind"))] | .[]'
}

rows "$here/auth_integrity.sql" | jq -r '"\(.check_name)\t\(.value)"' | column -t -s $'\t'

if $details; then
  echo
  rows "$here/auth_integrity_details.sql" | jq -r '"\(.kind)\t\(.id)\t\(.label)\t\(.created_at)"' |
    column -t -s $'\t'
fi
