-- ============================================================================
-- Native signup checks: the before_user_created hook and the confirmed-user
-- trigger on auth.users (20261020130000, 20261020140000), plus the signup
-- source they validate and store (20261118120000).
--
-- Plain script like the other files here: every check raises on failure and
-- the transaction rolls back, leaving no fixtures behind.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/native_signup.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

create function pg_temp.hook_message(input_meta jsonb) returns text
language sql as $$
  select public.before_user_created_hook(
    jsonb_build_object('user', jsonb_build_object('user_metadata', input_meta))
  ) -> 'error' ->> 'message'
$$;

create function pg_temp.insert_auth_user(input_id uuid, input_email text, input_meta jsonb, input_confirmed boolean)
returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (input_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          input_email, case when input_confirmed then now() end, '{}', input_meta, now(), now())
$$;

do $$
declare
  c_name_msg  constant text := 'Please enter your name.';
  c_long_msg  constant text := 'Your name can be at most 100 characters.';
  c_level_msg constant text := 'Enter your Playtomic level as a number, like 2.5.';
  c_ph_msg    constant text := 'You’ve already been added to a Lobster team — ask an admin to invite you.';
  c_src_msg   constant text := 'Please pick how you found us from the list.';
  c_detail_msg constant text := 'How you found us can be at most 100 characters.';
  v_full      jsonb;
  v_event     jsonb;
  v_res       jsonb;
  v_id        uuid;
  v_id2       uuid;
  v_player    public.players%rowtype;
  v_count     integer;
begin
  insert into public.players (name, status) values ('Hook  Placeholder', 'placeholder');

  -- CHECK 1: valid metadata is accepted with an empty object; blank and
  -- comma-decimal levels are valid, missing metadata is not
  v_full := jsonb_build_object('name', ' Valid   Person ', 'playtomic_level', '2,5');
  v_event := jsonb_build_object('user', jsonb_build_object('user_metadata', v_full));
  if public.before_user_created_hook(v_event) is distinct from '{}'::jsonb then
    raise exception 'CHECK 1 FAILED: valid signup not accepted';
  end if;
  if pg_temp.hook_message('{"name":"A","playtomic_level":""}') is not null
     or pg_temp.hook_message('{"name":"A"}') is not null
     or pg_temp.hook_message('{"name":"A","playtomic_level":" 3 "}') is not null then
    raise exception 'CHECK 1 FAILED: blank/missing/padded level rejected';
  end if;
  if public.before_user_created_hook('{"user":{}}') -> 'error' ->> 'message' is distinct from c_name_msg
     or public.before_user_created_hook('{}') -> 'error' ->> 'message' is distinct from c_name_msg then
    raise exception 'CHECK 1 FAILED: missing metadata not rejected as no name';
  end if;
  raise notice 'CHECK 1 ok: accept';

  -- CHECK 2: the error shape and the four rejections, exact strings
  v_res := public.before_user_created_hook(
    jsonb_build_object('user', jsonb_build_object('user_metadata', '{"name":"  "}'::jsonb)));
  if v_res is distinct from jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', c_name_msg)) then
    raise exception 'CHECK 2 FAILED: shape %', v_res;
  end if;
  if pg_temp.hook_message(jsonb_build_object('name', repeat('x', 101))) is distinct from c_long_msg
     or pg_temp.hook_message(jsonb_build_object('name', repeat('x', 100))) is not null then
    raise exception 'CHECK 2 FAILED: name length';
  end if;
  if pg_temp.hook_message('{"name":"A","playtomic_level":"abc"}') is distinct from c_level_msg
     or pg_temp.hook_message('{"name":"A","playtomic_level":"2."}') is distinct from c_level_msg
     or pg_temp.hook_message('{"name":"A","playtomic_level":"-1"}') is distinct from c_level_msg then
    raise exception 'CHECK 2 FAILED: level pattern';
  end if;
  if pg_temp.hook_message('{"name":" hook   PLACEHOLDER "}') is distinct from c_ph_msg then
    raise exception 'CHECK 2 FAILED: placeholder match';
  end if;
  if pg_temp.hook_message('{"name":"Hook Placeholder Jr"}') is not null then
    raise exception 'CHECK 2 FAILED: placeholder match is exact';
  end if;
  raise notice 'CHECK 2 ok: rejections';

  -- CHECK 3: rules apply in order, first match wins
  if pg_temp.hook_message('{"name":"","playtomic_level":"abc"}') is distinct from c_name_msg
     or pg_temp.hook_message(jsonb_build_object('name', repeat('x', 101), 'playtomic_level', 'abc')) is distinct from c_long_msg
     or pg_temp.hook_message('{"name":"Hook Placeholder","playtomic_level":"abc"}') is distinct from c_level_msg then
    raise exception 'CHECK 3 FAILED: order';
  end if;
  raise notice 'CHECK 3 ok: order';

  -- CHECK 4: only GoTrue's role can call the hook
  if not has_function_privilege('supabase_auth_admin', 'public.before_user_created_hook(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.before_user_created_hook(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.before_user_created_hook(jsonb)', 'execute') then
    raise exception 'CHECK 4 FAILED: grants';
  end if;
  raise notice 'CHECK 4 ok: grants';

  -- CHECK 5: an unconfirmed insert creates no player
  v_id := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id, 'Pending@Test.invalid', v_full, false);
  if exists (select 1 from public.players where id = v_id) then
    raise exception 'CHECK 5 FAILED: player created before confirmation';
  end if;
  raise notice 'CHECK 5 ok: unconfirmed insert';

  -- CHECK 6: the update to confirmed creates the player from the metadata, with
  -- no PIN, and the players insert does not create a second auth user or drift the identity
  update auth.users u
     set email_confirmed_at = now(),
         raw_user_meta_data = v_full || jsonb_build_object(
           'phone', '+31600000000', 'playtomic_username', 'hook', 'gender', 'female',
           'is_left_handed', 'true', 'country', 'NL', 'birthday', '1990-05-06',
           'preferred_position', 'left', 'tagline_label', 'Hi', 'notes', 'n', 'role', 'admin')
   where u.id = v_id;
  select * into v_player from public.players where id = v_id;
  if not found or v_player.name <> 'Valid Person' or v_player.email <> 'pending@test.invalid'
     or v_player.status <> 'active' or v_player.playtomic_level <> 2.5 or v_player.adjustment <> 0
     or v_player.adjusted_level <> 2.5 or v_player.phone <> '+31600000000'
     or v_player.playtomic_username <> 'hook' or v_player.gender <> 'female'
     or v_player.is_left_handed is not true or v_player.country <> 'NL'
     or v_player.birthday <> date '1990-05-06' or v_player.preferred_position <> 'left'
     or v_player.tagline_label <> 'Hi' or v_player.notes <> 'n'
     or v_player.role <> 'player' then
    raise exception 'CHECK 6 FAILED: %', row_to_json(v_player);
  end if;
  if (select count(*) from auth.users where id = v_id) <> 1
     or (select email from auth.users where id = v_id) <> 'Pending@Test.invalid'
     or (select count(*) from auth.identities where user_id = v_id) <> 1
     or (select identity_data ->> 'email' from auth.identities where user_id = v_id) <> 'Pending@Test.invalid' then
    raise exception 'CHECK 6 FAILED: auth user or identity drifted';
  end if;
  raise notice 'CHECK 6 ok: update-to-confirmed';

  -- CHECK 7: re-firing is a no-op, even with different metadata
  update public.players set name = 'Renamed' where id = v_id;
  update auth.users set email_confirmed_at = null where id = v_id;
  update auth.users set email_confirmed_at = now(),
         raw_user_meta_data = jsonb_build_object('name', 'Someone Else') where id = v_id;
  select count(*) into v_count from public.players where id = v_id and name = 'Renamed';
  if v_count <> 1 or (select count(*) from public.players where lower(email) = 'pending@test.invalid') <> 1 then
    raise exception 'CHECK 7 FAILED: second fire changed or duplicated the player';
  end if;
  raise notice 'CHECK 7 ok: idempotent';

  -- CHECK 8: an insert that is already confirmed creates the player, and the
  -- player insert's ensure_auth_user_for_player loop leaves one auth user and one identity
  v_id2 := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id2, 'confirmed@test.invalid',
    jsonb_build_object('name', 'Confirmed  Insert', 'playtomic_level', '', 'birthday', '2026-13-45',
                       'is_left_handed', 'false'), true);
  select * into v_player from public.players where id = v_id2;
  if not found or v_player.name <> 'Confirmed Insert' or v_player.playtomic_level <> 0
     or v_player.birthday is not null or v_player.is_left_handed is not false
     or (select count(*) from auth.users where id = v_id2) <> 1
     or (select count(*) from auth.identities where user_id = v_id2) <> 1
     or (select email from auth.users where id = v_id2) <> 'confirmed@test.invalid' then
    raise exception 'CHECK 8 FAILED: %', row_to_json(v_player);
  end if;
  raise notice 'CHECK 8 ok: insert-confirmed';

  -- CHECK 9: the reverse path (players insert -> confirmed auth user) finds
  -- the player already there; the trigger adds nothing
  insert into public.players (name, email) values ('Admin Added', 'added@test.invalid') returning id into v_id;
  if (select count(*) from public.players where lower(email) = 'added@test.invalid') <> 1
     or (select count(*) from auth.users where id = v_id) <> 1 then
    raise exception 'CHECK 9 FAILED';
  end if;
  raise notice 'CHECK 9 ok: reverse path';

  -- CHECK 10: a confirmed user without a usable name is skipped, not an error
  v_id := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id, 'noname@test.invalid', '{}', false);
  update auth.users set email_confirmed_at = now() where id = v_id;
  if exists (select 1 from public.players where id = v_id) then
    raise exception 'CHECK 10 FAILED: player created without a name';
  end if;
  raise notice 'CHECK 10 ok: nameless user skipped';

  -- CHECK 11: non-ASCII digits are refused by the hook and parse to 0, so a
  -- level can never fail the confirmation's numeric cast
  if pg_temp.hook_message('{"name":"A","playtomic_level":"２"}') is distinct from c_level_msg
     or private.parse_metadata_level('２') <> 0 then
    raise exception 'CHECK 11 FAILED: full-width digit';
  end if;
  raise notice 'CHECK 11 ok: ASCII digits only';

  -- CHECK 12: confirming an address another player holds (in any case) skips
  -- the player row instead of failing the confirmation
  insert into public.players (name, email) values ('Holder', 'holder@test.invalid');
  v_id := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id, 'HOLDER@test.invalid', '{"name":"Late Signup"}', false);
  update auth.users set email_confirmed_at = now() where id = v_id;
  if exists (select 1 from public.players where id = v_id)
     or (select email_confirmed_at from auth.users where id = v_id) is null then
    raise exception 'CHECK 12 FAILED: collision not skipped';
  end if;
  raise notice 'CHECK 12 ok: email collision skipped';

  -- CHECK 13: signup source (C-5): the four codes, absent or blank pass;
  -- an unknown code and an over-long lobster/other detail are refused; a
  -- detail with instagram/plaza_whatsapp is ignored
  if pg_temp.hook_message('{"name":"A","signup_source":"lobster","signup_source_detail":"A friend"}') is not null
     or pg_temp.hook_message('{"name":"A","signup_source":"instagram"}') is not null
     or pg_temp.hook_message('{"name":"A","signup_source":"plaza_whatsapp"}') is not null
     or pg_temp.hook_message('{"name":"A","signup_source":"other"}') is not null
     or pg_temp.hook_message('{"name":"A","signup_source":" "}') is not null
     or pg_temp.hook_message(jsonb_build_object('name', 'A', 'signup_source', 'other',
          'signup_source_detail', ' ' || repeat('x', 100) || ' ')) is not null
     or pg_temp.hook_message(jsonb_build_object('name', 'A', 'signup_source', 'instagram',
          'signup_source_detail', repeat('x', 101))) is not null then
    raise exception 'CHECK 13 FAILED: valid source refused';
  end if;
  if pg_temp.hook_message('{"name":"A","signup_source":"tiktok"}') is distinct from c_src_msg
     or pg_temp.hook_message(jsonb_build_object('name', 'A', 'signup_source', 'lobster',
          'signup_source_detail', repeat('x', 101))) is distinct from c_detail_msg
     or pg_temp.hook_message('{"name":"","signup_source":"tiktok"}') is distinct from c_name_msg
     or pg_temp.hook_message('{"name":"Hook Placeholder","signup_source":"tiktok"}') is distinct from c_src_msg then
    raise exception 'CHECK 13 FAILED: source rejections';
  end if;
  raise notice 'CHECK 13 ok: source validation';

  -- CHECK 14: confirming stores the source with a trimmed detail only for
  -- lobster/other, and nothing when no source was given
  v_id := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id, 'src-lobster@test.invalid',
    '{"name":"Src Lobster","signup_source":"lobster","signup_source_detail":"  A Friend  "}', true);
  v_id2 := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id2, 'src-insta@test.invalid',
    '{"name":"Src Insta","signup_source":"instagram","signup_source_detail":"ignored"}', true);
  if (select (source, detail) from public.player_signup_source where player_id = v_id)
       is distinct from ('lobster'::text, 'A Friend'::text)
     or (select (source, detail) from public.player_signup_source where player_id = v_id2)
       is distinct from ('instagram'::text, null::text)
     or exists (select 1 from public.player_signup_source s
                  join public.players p on p.id = s.player_id
                 where p.email in ('pending@test.invalid', 'confirmed@test.invalid')) then
    raise exception 'CHECK 14 FAILED: stored source';
  end if;
  raise notice 'CHECK 14 ok: source stored';

  -- CHECK 15: a source the table refuses (reaching the trigger without the
  -- hook) still confirms the account, without a source row
  v_id := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id, 'src-bad@test.invalid',
    jsonb_build_object('name', 'Src Bad', 'signup_source', 'other', 'signup_source_detail', repeat('x', 101)), false);
  update auth.users set email_confirmed_at = now() where id = v_id;
  v_id2 := gen_random_uuid();
  perform pg_temp.insert_auth_user(v_id2, 'src-unknown@test.invalid',
    '{"name":"Src Unknown","signup_source":"tiktok"}', true);
  if not exists (select 1 from public.players where id = v_id)
     or not exists (select 1 from public.players where id = v_id2)
     or exists (select 1 from public.player_signup_source where player_id in (v_id, v_id2)) then
    raise exception 'CHECK 15 FAILED: bad source broke confirmation or was stored';
  end if;
  raise notice 'CHECK 15 ok: bad source swallowed';

  -- CHECK 16: re-firing for an existing player adds no source row; deleting
  -- the player removes it; members can't read it
  update auth.users set email_confirmed_at = null where email = 'src-insta@test.invalid';
  update auth.users set email_confirmed_at = now(),
         raw_user_meta_data = '{"name":"Src Insta","signup_source":"other","signup_source_detail":"x"}'
   where email = 'src-insta@test.invalid';
  if (select source from public.player_signup_source s join public.players p on p.id = s.player_id
       where p.email = 'src-insta@test.invalid') is distinct from 'instagram' then
    raise exception 'CHECK 16 FAILED: re-fire changed the source';
  end if;
  delete from public.players where email = 'src-insta@test.invalid';
  if exists (select 1 from public.player_signup_source s
               left join public.players p on p.id = s.player_id where p.id is null) then
    raise exception 'CHECK 16 FAILED: no cascade';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.player_signup_source'::regclass)
     or has_table_privilege('anon', 'public.player_signup_source', 'select')
     or has_table_privilege('authenticated', 'public.player_signup_source', 'insert') then
    raise exception 'CHECK 16 FAILED: access';
  end if;
  raise notice 'CHECK 16 ok: idempotent, cascade, access';
end;
$$;

-- CHECK 17: RLS lets an admin read the source and hides it from a member
do $$
declare
  v_admin  integer;
  v_member integer;
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"admin"}}', true);
  set local role authenticated;
  select count(*) into v_admin from public.player_signup_source;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"player"}}', true);
  set local role authenticated;
  select count(*) into v_member from public.player_signup_source;
  reset role;
  if v_admin < 1 or v_member <> 0 then
    raise exception 'CHECK 17 FAILED: admin % member %', v_admin, v_member;
  end if;
  raise notice 'CHECK 17 ok: admin-read only';
end;
$$;

rollback;
