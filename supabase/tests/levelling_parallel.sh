#!/usr/bin/env bash
# ============================================================================
# complete_levelling double tap (20261112120000): two sessions call it at once
# for the same player. The first holds its transaction open; the second waits
# on the players row lock and must answer already_levelled, leaving one
# levelling row and one audit row. Needs committed fixtures, removed on exit.
#
#   supabase/tests/levelling_parallel.sh
# ============================================================================
set -euo pipefail

psql_() {
  docker exec -i supabase_db_padel-lobsters psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"
}

player_id="$(psql_ -c "insert into public.players (name, status) values ('Levelling Parallel Test', 'active') returning id")"
player_id="${player_id%%$'\n'*}"
cleanup() {
  psql_ -c "delete from public.players where id = '$player_id'; delete from auth.users where id = '$player_id';" >/dev/null
}
trap cleanup EXIT

call() {
  local hold="$1"
  psql_ <<SQL
begin;
select set_config('request.jwt.claims', '{"sub": "$player_id", "app_metadata": {"role": "member"}}', true);
select status from public.complete_levelling('{"years_playing": "under_1y", "frequency": "few_per_month", "lessons": "none", "racket_sports": "none", "walls": "corners", "playtomic_level": null, "prefilled": false}');
select pg_sleep($hold);
commit;
SQL
}

first="$(mktemp)"
second="$(mktemp)"
call 1.5 >"$first" &
first_pid=$!
sleep 0.5
call 0 >"$second" &
wait "$first_pid" $!

statuses="$(grep -E '^(ok|already_levelled|not_needed|invalid_answers)$' "$first" "$second" | cut -d: -f2 | sort | tr '\n' ' ')"
counts="$(psql_ -c "select (select count(*) from public.player_levelling where player_id = '$player_id') || ' ' || (select count(*) from public.rating_events where player_id = '$player_id')")"
rm -f "$first" "$second"

if [[ "$statuses" != "already_levelled ok " || "$counts" != "1 1" ]]; then
  echo "FAILED: statuses [$statuses], levelling/audit rows [$counts]" >&2
  exit 1
fi
echo "levelling_parallel: ok then already_levelled, one row each"
