#!/usr/bin/env bash
# Run the auth integrity check (PLAN.md §4.5) against the local stack or, read
# only, against production.
#
#   scripts/prod-rehearsal/integrity.sh --local              counts
#   scripts/prod-rehearsal/integrity.sh --linked             counts, production
#   scripts/prod-rehearsal/integrity.sh --local --details    plus names (keep out of PRs)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/../lib/supabase-cli.sh"

usage() { echo "usage: $0 --local|--linked [--details]  (--details is local only)" >&2 && exit 2; }

target=""
details=false
for arg in "$@"; do
  case "$arg" in
    --local | --linked) target="$arg" ;;
    --details) details=true ;;
    *) usage ;;
  esac
done
[[ -n "$target" ]] || usage
# Names never come straight from production; load a copy with sync.sh instead.
[[ "$target" == --local ]] || ! $details || usage

query_file="$(mktemp)"
trap 'rm -f "$query_file"' EXIT

# $1: the query file (auth_sets.sql is its WITH); $2: a key every row carries.
rows() {
  cat "$here/auth_sets.sql" "$1" >"$query_file"
  "$supabase_cli" db query "$target" --output-format json -f "$query_file" | json_rows "$2"
}

rows "$here/auth_integrity.sql" check_name | jq -r '"\(.check_name)\t\(.value)"' |
  column -t -s $'\t'

if $details; then
  echo
  rows "$here/auth_integrity_details.sql" kind |
    jq -r '"\(.kind)\t\(.id)\t\(.label)\t\(.created_at)"' | column -t -s $'\t'
fi
