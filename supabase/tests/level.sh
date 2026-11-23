#!/usr/bin/env bash
# ============================================================================
# One definition of a level (20261123180000, docs/signup-revamp S7, C-8; no
# level is null from S9, 20261124120000).
# Runs every case in level_cases.json, which the client's unit test reads
# too, through private.parse_level and each policy of private.level_to_store,
# then checks the column rule and the write paths. One transaction, rolled
# back.
#
#   supabase/tests/level.sh
# ============================================================================
set -euo pipefail

cases_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/level_cases.json"

docker exec -i supabase_db_padel-lobsters \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v cases="$(cat "$cases_file")" <<'SQL'
begin;

\o /dev/null
select set_config('test.level_cases', :'cases', true);
\o

create function pg_temp.check(input_ok boolean, input_label text)
returns void language plpgsql as $$
begin
  if input_ok is distinct from true then
    raise exception 'FAILED: %', input_label;
  end if;
end $$;

-- What a call gives, as the case file spells it: a number, 'null', or the error.
create function pg_temp.outcome(input_sql text)
returns text language plpgsql as $$
declare
  v_level numeric;
begin
  execute input_sql into v_level;
  return coalesce(v_level::text, 'null');
exception when raise_exception then
  return sqlerrm;
end $$;

create function pg_temp.act_as(input_player_id uuid, input_role text default 'member')
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', input_player_id,
                      'app_metadata', json_build_object('role', input_role))::text, true);
$$;

create function pg_temp.same(input_a text, input_b text)
returns boolean language sql as $$
  select input_a = input_b
      or (input_a ~ '^[0-9.]+$' and input_b ~ '^[0-9.]+$' and input_a::numeric = input_b::numeric)
$$;

-- The database's answer for a case outcome under a policy (C-8).
create function pg_temp.expected(input_outcome jsonb, input_policy text)
returns text language sql as $$
  select case
    when jsonb_typeof(input_outcome) = 'number' then (input_outcome #>> '{}')::numeric::text
    when input_outcome #>> '{}' = 'no_level' then 'null'
    when input_outcome #>> '{}' = 'invalid' then 'invalid_level'
    when input_outcome #>> '{}' = 'blank' and input_policy = 'keep' then 'level_required'
    when input_outcome #>> '{}' = 'blank' then 'invalid_level'
  end
$$;

do $$
declare
  v_case   jsonb;
  v_input  text;
  v_policy text;
  v_got    text;
  v_want   text;
  v_count  integer := 0;
begin
  for v_case in select jsonb_array_elements(current_setting('test.level_cases')::jsonb -> 'cases') loop
    v_input := v_case ->> 'input';

    v_got := pg_temp.outcome(format('select private.parse_level(%L)', v_input));
    v_want := case
      when jsonb_typeof(v_case -> 'level') = 'number' then (v_case ->> 'level')::numeric::text
      when jsonb_typeof(v_case -> 'level') = 'null' then 'null'
      else 'invalid_level'
    end;
    perform pg_temp.check(pg_temp.same(v_got, v_want),
      format('parse_level(%L): got %s, want %s', v_input, v_got, v_want));

    foreach v_policy in array array['required', 'optional', 'keep'] loop
      v_got := pg_temp.outcome(format('select private.level_to_store(%L, %L, 2.0)', v_input, v_policy));
      v_want := pg_temp.expected(v_case -> v_policy, v_policy);
      perform pg_temp.check(pg_temp.same(v_got, v_want),
        format('level_to_store(%L, %s): got %s, want %s', v_input, v_policy, v_got, v_want));
    end loop;

    -- keep with no level recorded behaves as optional.
    v_got := pg_temp.outcome(format('select private.level_to_store(%L, %L, null)', v_input, 'keep'));
    v_want := pg_temp.expected(v_case -> 'optional', 'optional');
    perform pg_temp.check(pg_temp.same(v_got, v_want),
      format('level_to_store(%L, keep, no level): got %s, want %s', v_input, v_got, v_want));

    v_count := v_count + 1;
  end loop;
  perform pg_temp.check(v_count >= 20, 'case file read');
  raise notice 'CHECK 1 ok: % shared cases', v_count;
end $$;

do $$
declare
  v_admin   uuid;
  v_me      uuid;
  v_none    uuid;
  v_added   uuid;
  v_err     text;
  v_bad     numeric;
begin
  perform set_config('app.audit_source', 'test_fixture', true);

  -- ── 2. The column refuses anything but null or a level ────────────────────
  foreach v_bad in array array[0, -1, 7.01, 7.5, 2.455, 0.001]::numeric[] loop
    begin
      insert into public.players (name, status, playtomic_level) values ('Level Column Test', 'active', v_bad);
      raise exception 'FAILED: column took %', v_bad;
    exception when check_violation then
      null;
    end;
  end loop;
  insert into public.players (name, status, playtomic_level)
  values ('Level Column Ok A', 'active', null), ('Level Column Ok B', 'active', 7), ('Level Column Ok C', 'active', 2.45);
  insert into public.players (name, status) values ('Level Column Default', 'active') returning id into v_none;
  perform pg_temp.check((select playtomic_level is null from public.players where id = v_none), '2a: default is no level');
  raise notice 'CHECK 2 ok: column';

  -- ── 3. update_my_profile (keep) ───────────────────────────────────────────
  insert into public.players (name, status, playtomic_level) values ('Level Me', 'active', 2.0) returning id into v_me;
  perform pg_temp.act_as(v_me);

  perform public.update_my_profile('{"phone": "0600000000"}');
  perform pg_temp.check((select playtomic_level = 2.0 from public.players where id = v_me), '3a: no key, unchanged');

  perform public.update_my_profile('{"playtomic_level": "2,75"}');
  perform pg_temp.check((select playtomic_level = 2.75 from public.players where id = v_me), '3b: decimal comma');

  foreach v_err in array array['""', '"0"', 'null', '0'] loop
    begin
      perform public.update_my_profile(('{"playtomic_level": ' || v_err || '}')::jsonb);
      raise exception 'FAILED: 3c cleared with %', v_err;
    exception when raise_exception then
      perform pg_temp.check(sqlerrm = 'level_required', '3c: clearing with ' || v_err || ' gave ' || sqlerrm);
    end;
  end loop;

  begin
    perform public.update_my_profile('{"playtomic_level": "2.755"}');
    v_err := null;
  exception when raise_exception then
    v_err := sqlerrm;
  end;
  perform pg_temp.check(v_err = 'invalid_level'
    and (select playtomic_level = 2.75 from public.players where id = v_me), '3d: three decimals refused');

  perform pg_temp.act_as(v_none);
  perform public.update_my_profile('{"playtomic_level": "0"}');
  perform pg_temp.check((select playtomic_level is null from public.players where id = v_none), '3e: no level stays none');
  raise notice 'CHECK 3 ok: update_my_profile';

  -- ── 4. admin_update_player (keep) and admin_add_player (optional) ─────────
  insert into public.players (name, status, playtomic_level) values ('Level Admin', 'active', 3.0) returning id into v_admin;
  update public.players set role = 'admin' where id = v_admin;
  perform pg_temp.act_as(v_admin, 'admin');

  begin
    perform public.admin_update_player(v_me, '{"playtomic_level": ""}');
    v_err := null;
  exception when raise_exception then
    v_err := sqlerrm;
  end;
  perform pg_temp.check(v_err = 'level_required', '4a: admin clearing refused');

  perform pg_temp.check(public.admin_update_player(v_none, '{"playtomic_level": ""}'), '4b: admin, no level, blank');
  perform public.admin_update_player(v_none, '{"playtomic_level": "1,5"}');
  perform pg_temp.check((select playtomic_level = 1.5 from public.players where id = v_none), '4c: admin sets a level');

  select id into v_added from public.admin_add_player('{"name": "Level Added Blank", "playtomic_level": ""}');
  perform pg_temp.check((select playtomic_level is null from public.players where id = v_added), '4d: add, blank is no level');
  select id into v_added from public.admin_add_player('{"name": "Level Added", "playtomic_level": 2.45}');
  perform pg_temp.check((select playtomic_level = 2.45 from public.players where id = v_added), '4e: add with a level');
  begin
    perform public.admin_add_player('{"name": "Level Added Bad", "playtomic_level": "7.5"}');
    v_err := null;
  exception when raise_exception then
    v_err := sqlerrm;
  end;
  perform pg_temp.check(v_err = 'invalid_level'
    and not exists (select 1 from public.players where name = 'Level Added Bad'), '4f: add refuses a bad level');
  raise notice 'CHECK 4 ok: admin paths';

  -- ── 5. create_partner_player (required) ───────────────────────────────────
  perform pg_temp.check(
    (select status = 'invalid_level' from private.create_partner_player(
       v_me, null, '{"name": "Level Partner", "email": "level.partner@test.invalid", "playtomic_level": "0"}', true, true)),
    '5a: partner level 0 refused');
  perform pg_temp.check(
    (select status = 'invalid_level' from private.create_partner_player(
       v_me, null, '{"name": "Level Partner", "email": "level.partner@test.invalid", "playtomic_level": "2.455"}', true, true)),
    '5b: partner three decimals refused');
  raise notice 'CHECK 5 ok: create_partner_player';
end $$;

rollback;
SQL
