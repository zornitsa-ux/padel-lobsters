-- ============================================================================
-- Admin invite and PIN reset checks (20261012130000) and the auth email
-- restore (20261012140000).
--
-- private.send_pin_email posts to the production edge function, so it is
-- replaced with a recorder inside this transaction. Everything rolls back.
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

do $$
declare
  v_admin  uuid;
  v_ph     uuid;
  v_ph2    uuid;
  v_taken  uuid;
  v_pin    text;
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
     or exists (select 1 from sent_pin_emails) then
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

  -- CHECK 4: a valid invite activates the row, returns a PIN that signs in,
  -- emails that PIN, and puts the real (lower-cased) address on auth.users
  v_pin := public.admin_invite_league_player(v_ph, ' One@Test.invalid ');
  select * into v_player from public.players where id = v_ph;
  select * into v_login from public.verify_player_pin_v2(v_pin, 'invite-device');
  if v_pin !~ '^\d{4}$' or v_player.status <> 'active' or v_player.email <> 'one@test.invalid'
     or v_login.player_id is distinct from v_ph then
    raise exception 'CHECK 4 FAILED: pin % row % login %', v_pin, row_to_json(v_player), row_to_json(v_login);
  end if;
  if not exists (select 1 from sent_pin_emails where player_id = v_ph and pin = v_pin and kind = 'new_signup') then
    raise exception 'CHECK 4 FAILED: invite email not sent';
  end if;
  if (select email from auth.users where id = v_ph) <> 'one@test.invalid' then
    raise exception 'CHECK 4 FAILED: auth.users email not synced';
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
end;
$$;

rollback;
