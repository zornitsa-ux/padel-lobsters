-- =====================================================================
-- Padel Lobsters — Security Phase 2b SQL: grace window + admin dashboard
-- =====================================================================
-- Adds the 21-day bootstrap grace window so existing users can transparently
-- get their main device trusted by just logging in once during that window.
-- Also adds the admin-side dashboard RPCs (list pending devices, list
-- security events, approve / deny a device) used by the new admin panels.
--
-- After the grace window expires, any player who has not yet logged in
-- will be on a brand-new device that requires admin approval — same flow
-- as a brand-new signup.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Grace window setting
-- ---------------------------------------------------------------------

-- Default = 21 days from now. Admin can extend or shorten via the
-- settings row. After this timestamp, first-device-per-player no longer
-- auto-trusts; admin approval becomes required for all new devices.
alter table public.settings
  add column if not exists auto_trust_until timestamptz default (now() + interval '21 days');

-- Initialize for the existing settings row if it's null
update public.settings
   set auto_trust_until = now() + interval '21 days'
 where id = 1 and auto_trust_until is null;


-- ---------------------------------------------------------------------
-- 2. Allow 'admin_action' in pin_attempts.attempt_kind
-- ---------------------------------------------------------------------
alter table public.pin_attempts drop constraint if exists pin_attempts_attempt_kind_check;
alter table public.pin_attempts
  add constraint pin_attempts_attempt_kind_check
  check (attempt_kind in (
    'player','admin','pii_dump','approve_device','admin_unlock','admin_action'
  ));


-- ---------------------------------------------------------------------
-- 3. verify_player_pin_v2 — grace-window auto-trust on first device
-- ---------------------------------------------------------------------
-- Same as 0003, with one new block: after upserting the device row, if
-- the player has no other trusted device AND we're inside the grace
-- window, mark this device as trusted automatically.
create or replace function public.verify_player_pin_v2(
  input_pin text, input_device_id text, input_user_agent text default null
) returns table (player_id uuid, is_new_device boolean, trusted boolean, status text)
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  v_player_id uuid; v_attached_player uuid; v_is_known_device boolean;
  v_is_trusted boolean; v_failures_24h int; v_failures_since_ok int;
  v_existing_trusted_count int; v_auto_trust_until timestamptz;
  c_max_per_device_24h constant int := 10; c_strikes_known_dev constant int := 5;
  c_lockout constant interval := '24 hours';
begin
  set local statement_timeout = '30s';
  if input_pin is null or length(input_pin) < 4 or input_device_id is null then
    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;

  -- Per-device 24h failure limit
  select count(*) into v_failures_24h from public.pin_attempts
   where device_id = input_device_id and succeeded = false and attempt_kind = 'player'
     and attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'rate_limited'::text; return;
  end if;

  -- PIN match: fast plaintext path, then bcrypt fallback
  -- (alias players as p so p.status doesn't shadow the OUT column `status`)
  select p.id into v_player_id from public.players p
   where p.pin is not null and p.pin = input_pin and coalesce(p.status,'active')='active' limit 1;
  if v_player_id is null then
    select p.id into v_player_id from public.players p
     where p.pin_hash is not null and p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
       and coalesce(p.status,'active')='active' limit 1;
  end if;

  -- WRONG PIN
  if v_player_id is null then
    select pd.player_id into v_attached_player from public.player_devices pd
     where pd.device_id = input_device_id order by pd.last_seen desc limit 1;
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_attached_player, input_device_id, input_user_agent, 'player', false);
    if v_attached_player is not null then
      select count(*) into v_failures_since_ok from public.pin_attempts
       where device_id = input_device_id and player_id = v_attached_player
         and succeeded = false and attempt_kind = 'player'
         and attempted_at > coalesce(
           (select max(attempted_at) from public.pin_attempts
             where device_id = input_device_id and player_id = v_attached_player
               and succeeded = true and attempt_kind = 'player'),
           '1900-01-01'::timestamptz);
      if v_failures_since_ok >= c_strikes_known_dev then
        update public.players set locked_until = now() + c_lockout where id = v_attached_player;
      end if;
    end if;
    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;

  -- RIGHT PIN, locked?
  if exists (select 1 from public.players where id = v_player_id and locked_until is not null and locked_until > now()) then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_player_id, input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'locked'::text; return;
  end if;

  -- RIGHT PIN, not locked: succeed. Upsert device row.
  v_is_known_device := exists (select 1 from public.player_devices where player_id = v_player_id and device_id = input_device_id);
  insert into public.player_devices(player_id, device_id, user_agent)
  values (v_player_id, input_device_id, input_user_agent)
  on conflict (player_id, device_id) do update set last_seen = now(), user_agent = excluded.user_agent;

  -- Grace window auto-trust:
  -- If the player has zero trusted devices AND we're within the window,
  -- auto-trust this device. Effect: existing players get their main
  -- device trusted on first login during the window; brand-new signups
  -- after the window must go through admin approval.
  select count(*) into v_existing_trusted_count
    from public.player_devices
   where player_id = v_player_id and trusted_at is not null;

  if v_existing_trusted_count = 0 then
    select s.auto_trust_until into v_auto_trust_until
      from public.settings s where s.id = 1 limit 1;
    if v_auto_trust_until is not null and v_auto_trust_until > now() then
      update public.player_devices set trusted_at = now()
       where player_id = v_player_id and device_id = input_device_id;
    end if;
  end if;

  -- Read final trust state (may have been just set by the grace block)
  select pd.trusted_at is not null into v_is_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;

  -- Successful login clears any prior lockout
  update public.players set locked_until = null where id = v_player_id;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded, was_new_device)
  values (v_player_id, input_device_id, input_user_agent, 'player', true, not v_is_known_device);

  return query select v_player_id, not v_is_known_device, coalesce(v_is_trusted, false), 'ok'::text;
end $$;

-- (grants from 0003 still in effect)


-- ---------------------------------------------------------------------
-- 4. admin_list_pending_devices — across all players
-- ---------------------------------------------------------------------
create or replace function public.admin_list_pending_devices(input_admin_pin text)
returns table (
  player_id uuid, player_name text, device_id text, user_agent text,
  first_seen timestamptz, last_seen timestamptz
)
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  return query
    select p.id, p.name, pd.device_id, pd.user_agent, pd.first_seen, pd.last_seen
      from public.player_devices pd
      join public.players p on p.id = pd.player_id
     where pd.trusted_at is null
     order by pd.first_seen desc;
end $$;
revoke execute on function public.admin_list_pending_devices(text) from public;
grant  execute on function public.admin_list_pending_devices(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. admin_list_security_events — recent pin_attempts feed
-- ---------------------------------------------------------------------
create or replace function public.admin_list_security_events(
  input_admin_pin text, input_limit int default 100
)
returns table (
  id bigint, player_id uuid, player_name text, device_id text,
  user_agent text, attempt_kind text, succeeded boolean,
  was_new_device boolean, attempted_at timestamptz
)
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  return query
    select pa.id, pa.player_id, p.name, pa.device_id, pa.user_agent,
           pa.attempt_kind, pa.succeeded, pa.was_new_device, pa.attempted_at
      from public.pin_attempts pa
      left join public.players p on p.id = pa.player_id
     order by pa.attempted_at desc
     limit greatest(1, least(input_limit, 500));
end $$;
revoke execute on function public.admin_list_security_events(text, int) from public;
grant  execute on function public.admin_list_security_events(text, int) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. admin_approve_device — admin sidebands the trusted-device requirement
-- ---------------------------------------------------------------------
create or replace function public.admin_approve_device(
  input_admin_pin text, input_target_player uuid, input_target_device text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare v_did_update boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 'denied'; end if;
  if input_target_player is null or input_target_device is null then return 'denied'; end if;

  with upd as (
    update public.player_devices set trusted_at = now()
     where player_id = input_target_player
       and device_id = input_target_device
       and trusted_at is null
     returning 1
  ) select exists(select 1 from upd) into v_did_update;

  if not v_did_update then return 'no_such_device'; end if;

  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  values (input_target_player, input_target_device, 'admin_action', true);
  return 'ok';
end $$;
revoke execute on function public.admin_approve_device(text, uuid, text) from public;
grant  execute on function public.admin_approve_device(text, uuid, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. admin_deny_device — removes the pending device row entirely.
--    The device will reappear in the pending list if the user logs in
--    again with the correct PIN, so this is more of a "clear noise"
--    operation than a permanent block.
-- ---------------------------------------------------------------------
create or replace function public.admin_deny_device(
  input_admin_pin text, input_target_player uuid, input_target_device text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 'denied'; end if;
  if input_target_player is null or input_target_device is null then return 'denied'; end if;

  with del as (
    delete from public.player_devices
     where player_id = input_target_player
       and device_id = input_target_device
       and trusted_at is null
     returning 1
  ) select exists(select 1 from del) into v_did_delete;

  if not v_did_delete then return 'no_such_device'; end if;

  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  values (input_target_player, input_target_device, 'admin_action', false);
  return 'ok';
end $$;
revoke execute on function public.admin_deny_device(text, uuid, text) from public;
grant  execute on function public.admin_deny_device(text, uuid, text) to anon, authenticated;


commit;
