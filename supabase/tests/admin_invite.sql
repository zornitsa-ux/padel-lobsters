-- ============================================================================
-- Admin invite checks (20261012130000, 20261020150000): invites and adds carry
-- no PIN, resend, readiness, the legacy PIN reset, and the auth email restore
-- (20261012140000).
--
-- private.send_pin_email and private.send_invite_email post to the production
-- edge functions, so both are replaced with recorders inside this transaction.
-- Everything rolls back.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/admin_invite.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

create temp table sent_pin_emails (player_id uuid, pin text, kind text);

create or replace function private.send_pin_email(input_player_id uuid, input_pin text, input_kind text)
 returns bigint language sql as $$
  insert into sent_pin_emails values (input_player_id, input_pin, input_kind) returning 1::bigint
$$;

create temp table sent_invite_emails (player_id uuid, kind text);

create or replace function private.send_invite_email(input_player_id uuid, input_kind text)
 returns bigint language sql as $$
  insert into sent_invite_emails values (input_player_id, input_kind) returning 1::bigint
$$;

do $$
declare
  v_admin  uuid;
  v_ph     uuid;
  v_ph2    uuid;
  v_taken  uuid;
  v_typo   uuid;
  v_pin    text;
  v_added  public.players%rowtype;
  v_ready  jsonb;
  v_login  record;
  v_player public.players%rowtype;
  v_err    text;
begin
  insert into public.players (name, status, email, role) values ('Invite Admin', 'active', 'admin@test.invalid', 'admin')
  returning id into v_admin;
  insert into public.players (name, status, pin) values ('Invitee One', 'placeholder', '') returning id into v_ph;
  insert into public.players (name, status, pin) values ('Invitee Two', 'placeholder', '') returning id into v_ph2;
  insert into public.players (name, status, email) values ('Taken Email', 'active', 'taken@test.invalid')
  returning id into v_taken;

  -- CHECK 1: non-admins cannot invite
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_taken, 'role', 'authenticated')::text, true);
  v_err := null;
  begin
    perform public.admin_invite_league_player(v_ph, 'one@test.invalid');
  exception when others then v_err := sqlerrm;
  end;
  if v_err not like 'unauthorized%' then raise exception 'CHECK 1 FAILED: got %', v_err; end if;
  raise notice 'CHECK 1 ok: admin only';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
                      'app_metadata', json_build_object('role', 'admin'))::text, true);

  -- CHECK 2: a malformed email is refused and nothing changes or is sent
  v_err := null;
  begin
    perform public.admin_invite_league_player(v_ph, 'one@test');
  exception when others then v_err := sqlerrm;
  end;
  select * into v_player from public.players where id = v_ph;
  if v_err is distinct from 'invalid email' or v_player.status <> 'placeholder'
     or exists (select 1 from sent_pin_emails) or exists (select 1 from sent_invite_emails) then
    raise exception 'CHECK 2 FAILED: got % row %', v_err, row_to_json(v_player);
  end if;
  raise notice 'CHECK 2 ok: malformed email refused';

  -- CHECK 3: an email held by another player or auth user is a clear error
  v_err := null;
  begin
    perform public.admin_invite_league_player(v_ph, ' TAKEN@test.invalid ');
  exception when others then v_err := sqlerrm;
  end;
  if v_err is distinct from 'email in use' then raise exception 'CHECK 3 FAILED (player): got %', v_err; end if;
  update auth.users set email = 'orphan@test.invalid' where id = v_ph2;
  v_err := null;
  begin
    perform public.admin_invite_league_player(v_ph, 'orphan@test.invalid');
  exception when others then v_err := sqlerrm;
  end;
  if v_err is distinct from 'email in use' then raise exception 'CHECK 3 FAILED (auth): got %', v_err; end if;
  raise notice 'CHECK 3 ok: taken email refused';

  -- CHECK 4: a valid invite activates the row without a PIN, returns NULL,
  -- records one league_invite email, and puts the real (lower-cased) address
  -- on auth.users
  v_pin := public.admin_invite_league_player(v_ph, ' One@Test.invalid ');
  select * into v_player from public.players where id = v_ph;
  if v_pin is not null or v_player.status <> 'active' or v_player.email <> 'one@test.invalid'
     or nullif(v_player.pin, '') is not null or v_player.pin_hash is not null then
    raise exception 'CHECK 4 FAILED: pin % row %', v_pin, row_to_json(v_player);
  end if;
  if (select count(*) from sent_invite_emails where player_id = v_ph and kind = 'league_invite') <> 1
     or exists (select 1 from sent_pin_emails) then
    raise exception 'CHECK 4 FAILED: invite email not recorded once, or a PIN email was sent';
  end if;
  if (select email from auth.users where id = v_ph) <> 'one@test.invalid' then
    raise exception 'CHECK 4 FAILED: auth.users email not synced';
  end if;
  if not exists (select 1 from public.pin_attempts where player_id = v_ph and attempt_kind = 'admin_action') then
    raise exception 'CHECK 4 FAILED: admin_action row missing';
  end if;
  raise notice 'CHECK 4 ok: invite';

  -- CHECK 5: an active player cannot be invited again
  v_err := null;
  begin
    perform public.admin_invite_league_player(v_ph, 'again@test.invalid');
  exception when others then v_err := sqlerrm;
  end;
  if v_err is distinct from 'player is not a placeholder' then raise exception 'CHECK 5 FAILED: got %', v_err; end if;
  raise notice 'CHECK 5 ok: no re-invite';

  update public.players set pin = '4321' where id = v_ph;
  v_pin := '4321';

  -- CHECK 6: PIN reset issues a working new PIN, retires the old one, and emails it
  v_err := v_pin;
  v_pin := public.admin_regenerate_pin(v_ph);
  select * into v_login from public.verify_player_pin_v2(v_pin, 'invite-device');
  if v_pin = v_err or v_login.player_id is distinct from v_ph
     or (select player_id from public.verify_player_pin_v2(v_err, 'invite-device')) is not null
     or not exists (select 1 from sent_pin_emails where pin = v_pin and kind = 'regenerated') then
    raise exception 'CHECK 6 FAILED: pin % login %', v_pin, row_to_json(v_login);
  end if;
  raise notice 'CHECK 6 ok: PIN reset';

  -- CHECK 7: the auth email restore fixes synthetic rows and skips taken addresses
  update auth.users set email = format('player-%s@padelobsters.internal', v_ph) where id = v_ph;
  update auth.users set email = format('player-%s@padelobsters.internal', v_taken) where id = v_taken;
  -- An auth user with no player row holds v_taken's address.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'taken@test.invalid', '{}', '{}', now(), now());
  update auth.users u
     set email              = lower(btrim(p.email)),
         email_confirmed_at = coalesce(u.email_confirmed_at, now())
    from public.players p
   where p.id = u.id
     and u.email like 'player-%@padelobsters.internal'
     and coalesce(p.status, 'active') <> 'deleted'
     and lower(btrim(p.email)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and not exists (
       select 1 from auth.users o
        where o.id <> u.id and lower(o.email) = lower(btrim(p.email))
     );
  if (select email from auth.users where id = v_ph) <> 'one@test.invalid'
     or (select email from auth.users where id = v_taken) not like 'player-%@padelobsters.internal' then
    raise exception 'CHECK 7 FAILED';
  end if;
  raise notice 'CHECK 7 ok: auth email restore';

  -- CHECK 8: admin_add_player stores no PIN, NULLs a blank email, and mails
  -- an 'added' invite only when there is an email
  delete from sent_invite_emails;
  select * into v_added from public.admin_add_player(
    jsonb_build_object('name', 'Added With Email', 'email', ' Added@Test.invalid '));
  if v_added.pin is not null or v_added.pin_hash is not null or v_added.email <> 'Added@Test.invalid'
     or (select count(*) from sent_invite_emails where player_id = v_added.id and kind = 'added') <> 1 then
    raise exception 'CHECK 8 FAILED (with email): %', row_to_json(v_added);
  end if;
  select * into v_added from public.admin_add_player(
    jsonb_build_object('name', 'Added Blank', 'email', '   '));
  if v_added.email is not null or v_added.pin is not null
     or exists (select 1 from sent_invite_emails where player_id = v_added.id) then
    raise exception 'CHECK 8 FAILED (blank): %', row_to_json(v_added);
  end if;
  v_err := null;
  begin perform public.admin_add_player(jsonb_build_object('name', 'Added Typo', 'email', 'typo@gmail'));
  exception when others then v_err := sqlstate || ' ' || sqlerrm; end;
  if v_err is distinct from '22023 invalid email'
     or exists (select 1 from public.players where name = 'Added Typo') then
    raise exception 'CHECK 8 FAILED (malformed): got %', v_err;
  end if;
  raise notice 'CHECK 8 ok: add player';

  -- CHECK 9: resend returns the address, records a 'resend' email and an
  -- admin_action row, and refuses unknown, placeholder, email-less and malformed-email players
  delete from sent_invite_emails;
  v_err := public.admin_resend_invite(v_ph);
  if v_err <> 'one@test.invalid'
     or (select count(*) from sent_invite_emails where player_id = v_ph and kind = 'resend') <> 1 then
    raise exception 'CHECK 9 FAILED: resend';
  end if;
  v_err := null;
  begin perform public.admin_resend_invite(gen_random_uuid());
  exception when others then v_err := sqlstate || ' ' || sqlerrm; end;
  if v_err is distinct from '22023 player not found' then raise exception 'CHECK 9 FAILED: got %', v_err; end if;
  v_err := null;
  begin perform public.admin_resend_invite(v_ph2);
  exception when others then v_err := sqlstate || ' ' || sqlerrm; end;
  if v_err is distinct from '22023 player is a placeholder' then raise exception 'CHECK 9 FAILED: got %', v_err; end if;
  v_err := null;
  begin perform public.admin_resend_invite(v_added.id);
  exception when others then v_err := sqlstate || ' ' || sqlerrm; end;
  if v_err is distinct from '22023 player has no email' then raise exception 'CHECK 9 FAILED: got %', v_err; end if;
  v_err := null;
  begin perform public.admin_resend_invite(v_taken);
  exception when others then v_err := sqlstate || ' ' || sqlerrm; end;
  if v_err is distinct from '22023 player has no email' then raise exception 'CHECK 9 FAILED (synthetic): got %', v_err; end if;
  insert into public.players (name, status, email) values ('Legacy Typo', 'active', 'legacy-typo@gmail')
  returning id into v_typo;
  delete from sent_invite_emails;
  v_err := null;
  begin perform public.admin_resend_invite(v_typo);
  exception when others then v_err := sqlstate || ' ' || sqlerrm; end;
  if v_err is distinct from '22023 invalid email' or exists (select 1 from sent_invite_emails) then
    raise exception 'CHECK 9 FAILED (malformed): got %', v_err;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_taken, 'role', 'authenticated')::text, true);
  v_err := null;
  begin perform public.admin_resend_invite(v_ph);
  exception when others then v_err := sqlerrm; end;
  if v_err not like 'unauthorized%' then raise exception 'CHECK 9 FAILED (non-admin): got %', v_err; end if;
  raise notice 'CHECK 9 ok: resend';

  -- CHECK 10: readiness lists synthetic-email active players and is admin
  -- only (the sign-in counts are covered by auth_readiness.sql)
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
                      'app_metadata', json_build_object('role', 'admin'))::text, true);
  v_ready := public.admin_auth_readiness();
  if (select array_agg(k order by k) from jsonb_object_keys(v_ready) k)
       <> array['no_email', 'recent_pin_users', 'still_pin_count', 'switched_count']
     or not v_ready -> 'no_email' @> jsonb_build_array(jsonb_build_object('id', v_taken, 'name', 'Taken Email'))
     or v_ready -> 'no_email' @> jsonb_build_array(jsonb_build_object('id', v_ph2, 'name', 'Invitee Two'))
     or exists (select 1 from jsonb_array_elements(v_ready -> 'no_email') e where e ->> 'id' = v_ph::text) then
    raise exception 'CHECK 10 FAILED: %', v_ready;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_taken, 'role', 'authenticated')::text, true);
  v_err := null;
  begin perform public.admin_auth_readiness();
  exception when others then v_err := sqlerrm; end;
  if v_err not like 'unauthorized%' then raise exception 'CHECK 10 FAILED (non-admin): got %', v_err; end if;
  raise notice 'CHECK 10 ok: readiness';

  -- CHECK 11: players.email cannot be blank
  v_err := null;
  begin update public.players set email = '  ' where id = v_taken;
  exception when check_violation then v_err := 'check_violation'; end;
  if v_err is distinct from 'check_violation' then raise exception 'CHECK 11 FAILED'; end if;
  raise notice 'CHECK 11 ok: blank email refused';
end;
$$;

rollback;

-- The real private.send_invite_email (the block above replaced it with a
-- recorder, which the rollback undid). The Vault key is stubbed; the request
-- is only queued in pg_net, and the rollback discards it unsent.
begin;

set local client_min_messages = notice;

create or replace function private.get_edge_service_role_key() returns text language sql as $$ select 'test-key'::text $$;

do $$
declare
  v_p1     uuid;
  v_p2     uuid;
  v_nomail uuid;
  v_req    bigint;
  v_body   jsonb;
  v_err    text;
begin
  insert into public.players (name, email, status) values ('Team Mate', 'mate@test.invalid', 'active') returning id into v_p1;
  insert into public.players (name, email, status) values ('Other Mate', 'other@test.invalid', 'active') returning id into v_p2;
  insert into public.players (name, status) values ('No Mail', 'active') returning id into v_nomail;

  -- CHECK 12: the newest league's team name goes in league_invite only
  insert into public.leagues (name, created_at) values ('Old League', now() - interval '1 year');
  insert into public.leagues (name, created_at) values ('New League', now());
  insert into public.league_teams (league_id, division, player1_id, player2_id, team_name, experience_level)
  select id, 'mens', v_p1, v_p2, 'Old Team', 'beginner' from public.leagues where name = 'Old League';
  insert into public.league_teams (league_id, division, player1_id, player2_id, team_name, experience_level)
  select id, 'mens', v_p1, v_p2, 'New Team', 'beginner' from public.leagues where name = 'New League';

  v_req := private.send_invite_email(v_p1, 'league_invite');
  select convert_from(body, 'utf8')::jsonb into v_body from net.http_request_queue where id = v_req;
  if v_body is distinct from jsonb_build_object(
       'player_id', v_p1::text, 'email', 'mate@test.invalid', 'name', 'Team Mate',
       'kind', 'league_invite', 'team_name', 'New Team') then
    raise exception 'CHECK 12 FAILED: league_invite body %', v_body;
  end if;
  v_req := private.send_invite_email(v_p1, 'added');
  select convert_from(body, 'utf8')::jsonb into v_body from net.http_request_queue where id = v_req;
  if v_body -> 'team_name' is distinct from 'null'::jsonb or v_body ->> 'kind' <> 'added' then
    raise exception 'CHECK 12 FAILED: added body %', v_body;
  end if;
  raise notice 'CHECK 12 ok: invite email body';

  -- CHECK 13: no email or a synthetic address sends nothing; a bad kind raises
  if private.send_invite_email(v_nomail, 'resend') is not null then
    raise exception 'CHECK 13 FAILED: sent to a player without email';
  end if;
  update public.players set email = 'x@padelobsters.internal' where id = v_p2;
  if private.send_invite_email(v_p2, 'resend') is not null then
    raise exception 'CHECK 13 FAILED: sent to a synthetic address';
  end if;
  begin perform private.send_invite_email(v_p1, 'new_signup');
  exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'send_invite_email: invalid kind: new_signup' then
    raise exception 'CHECK 13 FAILED: got %', v_err;
  end if;
  raise notice 'CHECK 13 ok: skips and invalid kind';
end;
$$;

rollback;
