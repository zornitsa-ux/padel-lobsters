#!/usr/bin/env bash
# Runs every database test in supabase/tests against the local stack: each .sql
# through psql, each .sh as it is. Every test rolls back its own transaction,
# so the data is left as it was. Exits non-zero if any test fails.
#
#   npm run db:test
set -uo pipefail

tests_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase/tests" && pwd)"
db_container=supabase_db_padel-lobsters
failed=()

for test in "$tests_dir"/*.sql "$tests_dir"/*.sh; do
  name="$(basename "$test")"
  if [[ "$test" == *.sql ]]; then
    output="$(docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$test" 2>&1)"
  else
    output="$(bash "$test" 2>&1)"
  fi
  if [[ $? -eq 0 ]]; then
    echo "ok    $name"
  else
    echo "FAIL  $name"
    echo "$output" | sed 's/^/      /'
    failed+=("$name")
  fi
done

if (( ${#failed[@]} )); then
  echo "${#failed[@]} database test(s) failed: ${failed[*]}" >&2
  exit 1
fi
