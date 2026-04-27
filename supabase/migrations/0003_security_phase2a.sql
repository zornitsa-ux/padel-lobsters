-- =====================================================================
-- Padel Lobsters — Security hardening, Phase 2a (infrastructure only)
-- =====================================================================
-- Adds the device-trust + lockout + audit-log infrastructure described in
-- the Phase 2 design discussion. Pure additive: every existing table,
-- function, and policy is left untouched, so the live app continues to
-- work unchanged. Phase 2b will switch the app to call these new _v2
-- functions and (only at that point) lock down direct SELECT on
-- public.players.
--
-- Layered defenses introduced here:
--   1. PIN attempt log + per-device rate limiting (10 fails / 24h)
--   2. Per-player lockout after 5 failures from a known device
--   3. Tiered device trust: a freshly-authenticated device starts as
--      "probationary" and must be approved from a trusted device or
--      by admin before it gets PII / write access.
--   4. Admin-PII function: rate limited (5 fails / 24h) and quota
--      capped (3 successful dumps / 24h globally).
--   5. Append-only audit log readable only via SECURITY DEFINER funcs.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------

-- Devices a player has authenticated from. A row appears the first time
-- a (player_id, device_id) pair successfully verifies a PIN.
-- trusted_at starts NULL ("probationary"); set by approve_device(...).
create table public.player_devices (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  device_id   text not null,
  user_agent  text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  trusted_at  timestamptz,
  unique (player_id, device_id)
);
create index player_devices_by_player on public.player_devices(player_id);
create index player_devices_by_device on public.player_devices(device_id);

-- Lock down: only SECURITY DEFINER functions touch this. RLS on with no
-- policies = no anon/authenticated access. Functions run as table owner
-- (postgres), which bypasses RLS by default.
alter table public.player_devices enable row level security;

-- Append-only audit log of every PIN attempt + sensitive action.
create table public.pin_attempts (
  id              bigserial primary key,
  player_id       uuid,                        -- null when wrong PIN matched no one
  device_id       text,
  ip_address      inet,                         -- populated by Phase 2b app code
  user_agent      text,
  attempt_kind    text not null check (attempt_kind in (
                    'player','admin','pii_dump','approve_device','admin_unlock'
                  )),
  succeeded       boolean not null,
  was_new_device  boolean,                      -- only set on succeeded=true logins
  attempted_at    timestamptz not null default now()
);
create index pin_attempts_by_device_time on public.pin_attempts(device_id, attempted_at desc);
create index pin_attempts_by_player_time on public.pin_attempts(player_id, attempted_at desc) where player_id is not null;
create index pin_attempts_recent_failures on public.pin_attempts(attempted_at desc) where succeeded = false;

alter table public.pin_attempts enable row level security;


-- ---------------------------------------------------------------------
-- 2. Lockout column on players
-- ---------------------------------------------------------------------
alter table public.players add column if not exists locked_until timestamptz;


-- ---------------------------------------------------------------------
-- 3. verify_player_pin_v2
--    Returns:
--      player_id      — uuid or null
--      is_new_device  — true iff first successful auth for this device
--      trusted        — true iff device's row has trusted_at set
--      status         — 'ok' | 'wrong_pin' | 'locked' | 'rate_limited'
-- ---------------------------------------------------------------------

create or replace function public.verify_player_pin_v2(
  input_pin        text,
  input_device_id  text,
  input_user_agent text default null
)
returns table (
  player_id     uuid,
  is_new_device boolean,
  trusted       boolean,
  status        text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_player_id          uuid;
  v_attached_player    uuid;
  v_is_known_device    boolean;
  v_is_trusted         boolean;
  v_failures_24h       int;
  v_failures_since_ok  int;
  c_max_per_device_24h constant int      := 10;
  c_strikes_known_dev  constant int      := 5;
  c_lockout            constant interval := '24 hours';
begin
  set local statement_timeout = '30s';

  if input_pin is null or length(input_pin) < 4 or input_device_id is null then
    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;

  -- Per-device 24h failure rate limit
  select count(*) into v_failures_24h
    from public.pin_attempts
   where device_id = input_device_id
     and succeeded = false
     and attempt_kind = 'player'
     and attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'rate_limited'::text; return;
  end if;

  -- PIN match: same two-stage logic as v1 (fast plaintext, bcrypt fallback).
  -- NOTE: alias players as `p` so `p.status` doesn't shadow this function's
  -- OUT column also named `status`.
  select p.id into v_player_id from public.players p
   where p.pin is not null and p.pin = input_pin
     and coalesce(p.status, 'active') = 'active'
   limit 1;
  if v_player_id is null then
    select p.id into v_player_id from public.players p
     where p.pin_hash is not null
       and p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
       and coalesce(p.status, 'active') = 'active'
     limit 1;
  end if;

  -- WRONG PIN: log, attribute to device's home player if any, possibly lock
  if v_player_id is null then
    select pd.player_id into v_attached_player
      from public.player_devices pd
     where pd.device_id = input_device_id
     order by pd.last_seen desc
     limit 1;

    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_attached_player, input_device_id, input_user_agent, 'player', false);

    if v_attached_player is not null then
      select count(*) into v_failures_since_ok
        from public.pin_attempts
       where device_id = input_device_id
         and player_id = v_attached_player
         and succeeded = false
         and attempt_kind = 'player'
         and attempted_at > coalesce(
           (select max(attempted_at) from public.pin_attempts
             where device_id = input_device_id
               and player_id = v_attached_player
               and succeeded = true
               and attempt_kind = 'player'),
           '1900-01-01'::timestamptz);

      if v_failures_since_ok >= c_strikes_known_dev then
        update public.players
           set locked_until = now() + c_lockout
         where id = v_attached_player;
      end if;
    end if;

    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;

  -- RIGHT PIN, locked?
  if exists (
    select 1 from public.players
     where id = v_player_id
       and locked_until is not null
       and locked_until > now()
  ) then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_player_id, input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'locked'::text; return;
  end if;

  -- RIGHT PIN, not locked: succeed. Upsert device row.
  v_is_known_device := exists (
    select 1 from public.player_devices
     where player_id = v_player_id and device_id = input_device_id);

  insert into public.player_devices(player_id, device_id, user_agent)
  values (v_player_id, input_device_id, input_user_agent)
  on conflict (player_id, device_id) do update
     set last_seen  = now(),
         user_agent = excluded.user_agent;

  select pd.trusted_at is not null into v_is_trusted
    from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;

  -- Successful login clears any prior lockout
  update public.players set locked_until = null where id = v_player_id;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded, was_new_device)
  values (v_player_id, input_device_id, input_user_agent, 'player', true, not v_is_known_device);

  return query select v_player_id, not v_is_known_device, coalesce(v_is_trusted, false), 'ok'::text;
end $$;

revoke execute on function public.verify_player_pin_v2(text, text, text) from public;
grant  execute on function public.verify_player_pin_v2(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. verify_admin_pin_v2 — rate limit + audit log around v1
-- ---------------------------------------------------------------------

create or replace function public.verify_admin_pin_v2(
  input_pin        text,
  input_device_id  text,
  input_user_agent text default null
)
returns table (
  is_admin boolean,
  status   text                                  -- 'ok' | 'wrong_pin' | 'rate_limited'
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_failures_24h       int;
  c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';

  if input_pin is null or length(input_pin) < 4 or input_device_id is null then
    return query select false, 'wrong_pin'::text; return;
  end if;

  select count(*) into v_failures_24h
    from public.pin_attempts
   where device_id = input_device_id
     and succeeded = false
     and attempt_kind = 'admin'
     and attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return query select false, 'rate_limited'::text; return;
  end if;

  if not public.verify_admin_pin(input_pin) then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return query select false, 'wrong_pin'::text; return;
  end if;

  insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
  values (input_device_id, input_user_agent, 'admin', true);
  return query select true, 'ok'::text;
end $$;

revoke execute on function public.verify_admin_pin_v2(text, text, text) from public;
grant  execute on function public.verify_admin_pin_v2(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. get_my_profile_v2 — only returns the row if device is trusted
-- ---------------------------------------------------------------------

create or replace function public.get_my_profile_v2(
  input_pin       text,
  input_device_id text
)
returns setof public.players
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_player_id  uuid;
  v_is_trusted boolean;
begin
  set local statement_timeout = '30s';

  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_device_id is null then return; end if;

  select pd.trusted_at is not null into v_is_trusted
    from public.player_devices pd
   where pd.player_id = v_player_id
     and pd.device_id = input_device_id;
  if not coalesce(v_is_trusted, false) then return; end if;

  return query select * from public.players where id = v_player_id;
end $$;

revoke execute on function public.get_my_profile_v2(text, text) from public;
grant  execute on function public.get_my_profile_v2(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. get_all_players_with_pii_v2 — admin only, rate-limited, quota-capped
-- ---------------------------------------------------------------------

create or replace function public.get_all_players_with_pii_v2(
  input_admin_pin  text,
  input_device_id  text,
  input_user_agent text default null
)
returns setof public.players
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_failures_24h       int;
  v_dumps_today        int;
  c_max_fail_24h       constant int := 5;
  c_max_dumps_24h      constant int := 3;
begin
  set local statement_timeout = '30s';

  if input_admin_pin is null or length(input_admin_pin) < 4 or input_device_id is null then
    return;
  end if;

  -- Rate limit failed admin attempts on this device
  select count(*) into v_failures_24h
    from public.pin_attempts
   where device_id = input_device_id
     and succeeded = false
     and attempt_kind = 'admin'
     and attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_fail_24h then return; end if;

  -- Verify admin PIN
  if not public.verify_admin_pin(input_admin_pin) then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return;
  end if;

  -- Global daily quota on successful pii_dump (admin is singleton)
  select count(*) into v_dumps_today
    from public.pin_attempts
   where attempt_kind = 'pii_dump'
     and succeeded = true
     and attempted_at > now() - interval '24 hours';
  if v_dumps_today >= c_max_dumps_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'pii_dump', false);
    return;
  end if;

  -- All gates passed — log and return the roster
  insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
  values (input_device_id, input_user_agent, 'pii_dump', true);

  return query select * from public.players order by name;
end $$;

revoke execute on function public.get_all_players_with_pii_v2(text, text, text) from public;
grant  execute on function public.get_all_players_with_pii_v2(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. is_my_device_trusted — cheap polling endpoint for the new device
--    No PIN required. The only fact leaked is "is X trusted for Y",
--    which is low-value and protected from enumeration by the fact
--    that device_ids are random uuids.
-- ---------------------------------------------------------------------

create or replace function public.is_my_device_trusted(
  input_player_id uuid,
  input_device_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.player_devices
     where player_id = input_player_id
       and device_id = input_device_id
       and trusted_at is not null
  );
$$;

revoke execute on function public.is_my_device_trusted(uuid, text) from public;
grant  execute on function public.is_my_device_trusted(uuid, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. list_pending_devices — caller's device must be trusted; returns
--    that player's own untrusted devices (so the user can pick which
--    one to approve).
-- ---------------------------------------------------------------------

create or replace function public.list_pending_devices(
  input_pin                  text,
  input_requesting_device_id text
)
returns table (
  device_id  text,
  user_agent text,
  first_seen timestamptz,
  last_seen  timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_player_id uuid;
  v_caller_trusted boolean;
begin
  set local statement_timeout = '30s';
  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_requesting_device_id is null then return; end if;

  select pd.trusted_at is not null into v_caller_trusted
    from public.player_devices pd
   where pd.player_id = v_player_id
     and pd.device_id = input_requesting_device_id;
  if not coalesce(v_caller_trusted, false) then return; end if;

  return query
    select pd.device_id, pd.user_agent, pd.first_seen, pd.last_seen
      from public.player_devices pd
     where pd.player_id = v_player_id
       and pd.trusted_at is null
     order by pd.first_seen desc;
end $$;

revoke execute on function public.list_pending_devices(text, text) from public;
grant  execute on function public.list_pending_devices(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 9. approve_device — caller's device must already be trusted. Marks
--    the target device as trusted for the caller's player_id.
-- ---------------------------------------------------------------------

create or replace function public.approve_device(
  input_pin                  text,
  input_requesting_device_id text,
  input_target_device_id     text
)
returns text                                     -- 'ok' | 'denied' | 'no_such_device'
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_player_id      uuid;
  v_caller_trusted boolean;
  v_target_exists  boolean;
begin
  set local statement_timeout = '30s';

  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null
     or input_requesting_device_id is null
     or input_target_device_id is null
  then
    return 'denied';
  end if;

  select pd.trusted_at is not null into v_caller_trusted
    from public.player_devices pd
   where pd.player_id = v_player_id
     and pd.device_id = input_requesting_device_id;
  if not coalesce(v_caller_trusted, false) then return 'denied'; end if;

  select exists (
    select 1 from public.player_devices
     where player_id = v_player_id
       and device_id = input_target_device_id
  ) into v_target_exists;
  if not v_target_exists then return 'no_such_device'; end if;

  update public.player_devices
     set trusted_at = now()
   where player_id = v_player_id
     and device_id = input_target_device_id
     and trusted_at is null;

  insert into public.pin_attempts(
    player_id, device_id, attempt_kind, succeeded, was_new_device
  ) values (
    v_player_id, input_target_device_id, 'approve_device', true, false
  );

  return 'ok';
end $$;

revoke execute on function public.approve_device(text, text, text) from public;
grant  execute on function public.approve_device(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 10. admin_unlock_player — manual unlock by admin. Also auto-trusts a
--     specified target device for the player so they can get back in.
-- ---------------------------------------------------------------------

create or replace function public.admin_unlock_player(
  input_admin_pin       text,
  input_target_player   uuid,
  input_target_device   text default null,
  input_admin_device_id text default null
)
returns text                                     -- 'ok' | 'denied'
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  set local statement_timeout = '30s';

  if not public.verify_admin_pin(input_admin_pin) then return 'denied'; end if;
  if input_target_player is null then return 'denied'; end if;

  update public.players set locked_until = null where id = input_target_player;

  if input_target_device is not null then
    insert into public.player_devices(player_id, device_id, trusted_at)
    values (input_target_player, input_target_device, now())
    on conflict (player_id, device_id) do update
      set trusted_at = coalesce(public.player_devices.trusted_at, now());
  end if;

  insert into public.pin_attempts(
    player_id, device_id, attempt_kind, succeeded
  ) values (
    input_target_player, input_admin_device_id, 'admin_unlock', true
  );

  return 'ok';
end $$;

revoke execute on function public.admin_unlock_player(text, uuid, text, text) from public;
grant  execute on function public.admin_unlock_player(text, uuid, text, text) to anon, authenticated;


commit;

-- =====================================================================
-- Notes
--
-- Live alongside v1: verify_player_pin, verify_admin_pin, get_my_profile,
-- and get_all_players_with_pii are NOT modified. The app keeps using them
-- until Phase 2b cuts over to the _v2 names. At that point we can also
-- REVOKE direct SELECT on public.players from anon/authenticated, since
-- get_my_profile_v2 + the players_public view will cover all read paths.
--
-- Bootstrap (will be handled in Phase 2b, not here):
--   * Existing users: their next login from any device is a "new device"
--     because no rows exist in player_devices yet. The Phase 2b rollout
--     will include a one-time grace window where the first device per
--     player auto-trusts, OR admin will pre-approve one device per
--     active player at cutover.
--   * New signups: admin approves the first device after creating the
--     player and giving them their PIN, same as the steady-state new-
--     device flow.
--
-- New tables (player_devices, pin_attempts) have RLS enabled with no
-- policies. Direct anon/authenticated access returns zero rows; only the
-- SECURITY DEFINER functions above (which run as the table owner and
-- bypass RLS) can read/write them.
-- =====================================================================
