#!/usr/bin/env bash
# ============================================================================
# complete_levelling double tap (20261112120000, 20261118180000): two sessions
# call it at once for the same player. The first holds its transaction open;
# the second waits on the players row lock and must answer already_levelled.
# Run for a player with no level (one levelling row, one audit row) and for one
# with a level answering only (one levelling row, no audit row). Needs
# committed fixtures, removed on exit.
#
#   supabase/tests/levelling_parallel.sh
# ============================================================================
set -euo pipefail

psql_() {
  docker exec -i supabase_db_padel-lobsters psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"
}

players=()
cleanup() {
  # Guarded expansion: bash 3.2 with set -u calls an empty array unbound.
  for id in ${players[@]+"${players[@]}"}; do
    psql_ -c "delete from public.players where id = '$id'; delete from auth.users where id = '$id';" >/dev/null
  done
}
trap cleanup EXIT

new_player() {
  local id
  id="$(psql_ -c "insert into public.players (name, status, playtomic_level) values ('Levelling Parallel Test', 'active', $1) returning id")"
  echo "${id%%$'\n'*}"
}

call() {
  local player_id="$1" hold="$2"
  psql_ <<SQL
begin;
select set_config('request.jwt.claims', '{"sub": "$player_id", "app_metadata": {"role": "member"}}', true);
select status from public.complete_levelling('{"years_playing": "under_1y", "frequency": "few_per_month", "lessons": "none", "racket_sports": "none", "walls": "corners", "playtomic_level": null}');
select pg_sleep($hold);
commit;
SQL
}

race() {
  local label="$1" player_id="$2" expected_counts="$3"
  local first second statuses counts
  first="$(mktemp)"
  second="$(mktemp)"
  call "$player_id" 1.5 >"$first" &
  local first_pid=$!
  sleep 0.5
  call "$player_id" 0 >"$second" &
  wait "$first_pid" $!

  statuses="$(grep -E '^(ok|already_levelled|not_needed|invalid_answers)$' "$first" "$second" | cut -d: -f2 | sort | tr '\n' ' ')"
  counts="$(psql_ -c "select (select count(*) from public.player_levelling where player_id = '$player_id') || ' ' || (select count(*) from public.rating_events where player_id = '$player_id')")"
  rm -f "$first" "$second"

  if [[ "$statuses" != "already_levelled ok " || "$counts" != "$expected_counts" ]]; then
    echo "FAILED ($label): statuses [$statuses], levelling/audit rows [$counts]" >&2
    exit 1
  fi
}

players+=("$(new_player null)")
race "no level" "${players[0]}" "1 1"
players+=("$(new_player 2.0)")
race "answers only" "${players[1]}" "1 0"
echo "levelling_parallel: ok then already_levelled, for a start and for answers only"
