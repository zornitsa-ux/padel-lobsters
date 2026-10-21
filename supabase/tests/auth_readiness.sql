-- ============================================================================
-- Auth readiness checks (20261021120000): admin_auth_readiness counts
-- (switched / still on PIN / recent PIN users, 5-minute PIN-to-sign-in rule)
-- and custom_access_token_hook dropping a stale role. Everything rolls back.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/auth_readiness.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

do $$
declare
  v_admin    uuid;
  v_base_pin int;
  v_base_sw  int;
  v_ready    jsonb;
  v_hook     jsonb;
  v_ids      uuid[];
  v_err      text;
  v_now      timestamptz := now();
  v_pin1     uuid; v_edge5 uuid; v_over5 uuid; v_old uuid; v_after uuid;
  v_nosign   uuid; v_email uuid; v_ph uuid; v_inactive uuid; v_newer uuid; v_older uuid;
begin
  insert into public.players (name, status, email, role) values ('Ready Admin', 'active', 'ready-admin@test.invalid', 'admin')
  returning id into v_admin;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
                      'app_metadata', json_build_object('role', 'admin'))::text, true);
  v_ready := public.admin_auth_readiness();
  v_base_pin := (v_ready ->> 'still_pin_count')::int;
  v_base_sw  := (v_ready ->> 'switched_count')::int;

  insert into public.players (name, status, email) values ('R PIN 1min', 'active', 'r1@test.invalid') returning id into v_pin1;
  insert into public.players (name, status, email) values ('R PIN 5min', 'active', 'r2@test.invalid') returning id into v_edge5;
  insert into public.players (name, status, email) values ('R PIN 5min1s', 'active', 'r3@test.invalid') returning id into v_over5;
  insert into public.players (name, status, email) values ('R PIN 20d', 'active', 'r4@test.invalid') returning id into v_old;
  insert into public.players (name, status, email) values ('R PIN after', 'active', 'r5@test.invalid') returning id into v_after;
  insert into public.players (name, status, email) values ('R no sign-in', 'active', 'r6@test.invalid') returning id into v_nosign;
  insert into public.players (name, status, email) values ('R email only', 'active', 'r7@test.invalid') returning id into v_email;
  insert into public.players (name, status, email) values ('R inactive', 'inactive', 'r8@test.invalid') returning id into v_inactive;
  insert into public.players (name, status, email) values ('R PIN newer', 'active', 'r9@test.invalid') returning id into v_newer;
  insert into public.players (name, status, email) values ('R PIN older', 'active', 'r10@test.invalid') returning id into v_older;
  insert into public.players (name, status, pin) values ('R placeholder', 'placeholder', '') returning id into v_ph;

  update auth.users set last_sign_in_at = v_now - interval '1 day' where id in (v_pin1, v_edge5, v_over5, v_after, v_email, v_inactive, v_ph, v_newer, v_older);
  update auth.users set last_sign_in_at = v_now - interval '20 days' where id = v_old;

  insert into public.pin_attempts (player_id, attempt_kind, succeeded, attempted_at) values
    (v_pin1,     'player', true,  v_now - interval '1 day' - interval '1 minute'),
    (v_edge5,    'player', true,  v_now - interval '1 day' - interval '5 minutes'),
    (v_over5,    'player', true,  v_now - interval '1 day' - interval '5 minutes 1 second'),
    (v_old,      'player', true,  v_now - interval '20 days' - interval '1 minute'),
    (v_after,    'player', true,  v_now - interval '1 day' + interval '1 minute'),
    (v_nosign,   'player', true,  v_now - interval '1 hour'),
    (v_inactive, 'player', true,  v_now - interval '1 day' - interval '1 minute'),
    (v_ph,       'player', true,  v_now - interval '1 day' - interval '1 minute'),
    (v_email,    'player', false, v_now - interval '1 day' - interval '1 minute'),
    (v_email,    'admin',  true,  v_now - interval '1 day' - interval '1 minute'),
    (v_older,    'player', true,  v_now - interval '10 days'),
    (v_newer,    'player', true,  v_now - interval '10 days'),
    (v_newer,    'player', true,  v_now - interval '1 day' - interval '1 minute');

  v_ready := public.admin_auth_readiness();

  -- CHECK 1: exact keys, no password_count
  if (select array_agg(k order by k) from jsonb_object_keys(v_ready) k)
       <> array['no_email', 'recent_pin_users', 'still_pin_count', 'switched_count'] then
    raise exception 'CHECK 1 FAILED: keys %', v_ready;
  end if;
  raise notice 'CHECK 1 ok: keys';

  -- CHECK 2: PIN 1 min and exactly 5 min before sign-in count as PIN; 5m01s,
  -- a PIN after the sign-in, and a failed or non-player PIN do not
  select array_agg((e ->> 'id')::uuid) into v_ids from jsonb_array_elements(v_ready -> 'recent_pin_users') e;
  if not (v_ids @> array[v_pin1, v_edge5, v_newer]) or v_ids && array[v_over5, v_after, v_email, v_nosign] then
    raise exception 'CHECK 2 FAILED: %', v_ready -> 'recent_pin_users';
  end if;
  raise notice 'CHECK 2 ok: 5-minute rule';

  -- CHECK 3: counts. Still PIN: 1min, 5min, 20d, newer. Switched: 5m01s,
  -- after, email only, older (its PIN is 10 days before sign-in)
  if (v_ready ->> 'still_pin_count')::int - v_base_pin <> 4
     or (v_ready ->> 'switched_count')::int - v_base_sw <> 4 then
    raise exception 'CHECK 3 FAILED: % (base % / %)', v_ready, v_base_pin, v_base_sw;
  end if;
  raise notice 'CHECK 3 ok: counts, including no sign-in, inactive and placeholder excluded';

  -- CHECK 4: a PIN sign-in older than 14 days is counted but not listed; the
  -- list uses the latest PIN and orders newest first
  if v_ids && array[v_old] or v_ids && array[v_inactive, v_ph, v_older] then
    raise exception 'CHECK 4 FAILED: %', v_ready -> 'recent_pin_users';
  end if;
  if (select (e ->> 'last_pin_at')::timestamptz from jsonb_array_elements(v_ready -> 'recent_pin_users') e
       where (e ->> 'id')::uuid = v_newer) <> v_now - interval '1 day' - interval '1 minute' then
    raise exception 'CHECK 4 FAILED: last_pin_at is not the latest PIN';
  end if;
  if (select array_agg((e ->> 'last_pin_at')::timestamptz) from jsonb_array_elements(v_ready -> 'recent_pin_users') e)
       <> (select array_agg(t order by t desc) from (select (e ->> 'last_pin_at')::timestamptz t
             from jsonb_array_elements(v_ready -> 'recent_pin_users') e) s) then
    raise exception 'CHECK 4 FAILED: not newest first';
  end if;
  raise notice 'CHECK 4 ok: recency window and order';

  -- CHECK 5: non-admins are rejected
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_pin1, 'role', 'authenticated')::text, true);
  begin perform public.admin_auth_readiness();
  exception when others then v_err := sqlerrm; end;
  if v_err not like 'unauthorized%' then raise exception 'CHECK 5 FAILED: got %', v_err; end if;
  raise notice 'CHECK 5 ok: admin only';

  -- CHECK 6: hook sets the role from players
  v_hook := public.custom_access_token_hook(jsonb_build_object(
    'user_id', v_admin,
    'claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal1',
      'app_metadata', jsonb_build_object('role', 'player', 'device_trusted', true, 'device_id', 'd', 'provider', 'email'))));
  if v_hook #>> '{claims,app_metadata,role}' <> 'admin'
     or v_hook #> '{claims,app_metadata}' ?| array['device_trusted', 'device_id']
     or v_hook #>> '{claims,app_metadata,provider}' <> 'email'
     or v_hook #>> '{claims,role}' <> 'authenticated'
     or v_hook #>> '{claims,aal}' <> 'aal1' then
    raise exception 'CHECK 6 FAILED: %', v_hook;
  end if;
  raise notice 'CHECK 6 ok: role from players, device claims stripped';

  -- CHECK 7: no players row -> app_metadata.role removed, rest untouched
  v_hook := public.custom_access_token_hook(jsonb_build_object(
    'user_id', gen_random_uuid(),
    'claims', jsonb_build_object('role', 'authenticated',
      'app_metadata', jsonb_build_object('role', 'admin', 'device_id', 'd', 'provider', 'email'))));
  if v_hook #> '{claims,app_metadata}' ? 'role'
     or v_hook #> '{claims,app_metadata}' ? 'device_id'
     or v_hook #>> '{claims,app_metadata,provider}' <> 'email'
     or v_hook #>> '{claims,role}' <> 'authenticated' then
    raise exception 'CHECK 7 FAILED: %', v_hook;
  end if;
  raise notice 'CHECK 7 ok: stale role removed';
end;
$$;

rollback;
