#!/usr/bin/env bash
# ============================================================================
# When an event is finished (docs/event-system C-1, C-4).
# Inserts every case in event_finished_cases.json, which the client's unit
# test reads too, as a tournament and checks private.event_finished(id, now).
# One transaction, rolled back.
#
#   supabase/tests/event_finished.sh
# ============================================================================
set -euo pipefail

cases_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/event_finished_cases.json"

docker exec -i supabase_db_padel-lobsters \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v cases="$(cat "$cases_file")" <<'SQL'
begin;

\o /dev/null
select set_config('test.finished_cases', :'cases', true);
\o

do $$
declare
  v_case jsonb;
  v_id uuid;
  v_got boolean;
  v_count int := 0;
begin
  for v_case in select jsonb_array_elements(current_setting('test.finished_cases')::jsonb -> 'cases') loop
    insert into public.tournaments(name, date, time, duration, status)
    values ('Finished case', (v_case ->> 'date')::date, v_case ->> 'time',
            (v_case ->> 'duration')::int, v_case ->> 'status')
    returning id into v_id;
    v_got := private.event_finished(v_id, (v_case ->> 'now')::timestamptz);
    if v_got is distinct from (v_case ->> 'finished')::boolean then
      raise exception 'FAILED: % (got %, end %)', v_case ->> 'name', v_got, public.tournament_end_ts(v_id);
    end if;
    v_count := v_count + 1;
  end loop;

  if v_count < 20 then
    raise exception 'FAILED: only % cases ran', v_count;
  end if;
  if private.event_finished(gen_random_uuid()) is not null then
    raise exception 'FAILED: an unknown event should give null';
  end if;

  raise notice 'event finished: % cases ok', v_count;
end $$;

rollback;
SQL
