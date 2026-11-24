#!/usr/bin/env bash
# ============================================================================
# Anonymised and reserved names (docs/account-deletion C-1).
# Runs every case in anonymised_name_cases.json, which the client's unit test
# reads too, through private.is_anonymised_name and private.is_reserved_name,
# and checks that every name private.anonymised_name gives is both.
# One transaction, rolled back.
#
#   supabase/tests/anonymised_names.sh
# ============================================================================
set -euo pipefail

cases_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/anonymised_name_cases.json"

docker exec -i supabase_db_padel-lobsters \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v cases="$(cat "$cases_file")" <<'SQL'
begin;

\o /dev/null
select set_config('test.name_cases', :'cases', true);
\o

do $$
declare
  v_case jsonb;
  v_name text;
begin
  for v_case in select jsonb_array_elements(current_setting('test.name_cases')::jsonb -> 'cases') loop
    v_name := v_case ->> 'name';
    if private.is_anonymised_name(v_name) is distinct from (v_case ->> 'anonymised')::boolean then
      raise exception 'FAILED: is_anonymised_name(%) should be %', v_name, v_case ->> 'anonymised';
    end if;
    if private.is_reserved_name(v_name) is distinct from (v_case ->> 'reserved')::boolean then
      raise exception 'FAILED: is_reserved_name(%) should be %', v_name, v_case ->> 'reserved';
    end if;
  end loop;

  if private.is_anonymised_name(null) or private.is_reserved_name(null) then
    raise exception 'FAILED: a missing name is neither';
  end if;

  for n in 1..30 loop
    v_name := private.anonymised_name(n);
    if not (private.is_anonymised_name(v_name) and private.is_reserved_name(v_name)) then
      raise exception 'FAILED: % is not both anonymised and reserved', v_name;
    end if;
  end loop;

  raise notice 'anonymised names ok';
end $$;

rollback;
SQL
