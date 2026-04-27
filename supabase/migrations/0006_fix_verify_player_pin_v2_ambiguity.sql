-- =====================================================================
-- Fix: column reference "player_id" is ambiguous in verify_player_pin_v2
-- =====================================================================
-- The function's RETURNS TABLE declares `player_id uuid` as an OUT
-- column. PL/pgSQL's default conflict resolution is "error", so any
-- bare `WHERE player_id = ...` (or `ON CONFLICT (player_id, ...)`)
-- inside the body cannot be resolved between (a) the OUT variable
-- and (b) the actual table column on player_devices / pin_attempts.
--
-- This was missed in 0005 because the affected queries are only on
-- the SUCCESS path (right PIN). Wrong-PIN attempts short-circuit
-- before reaching them, so the SQL smoke tests passed. The bug
-- surfaced when a real user entered a real PIN through the app
-- (visible in browser console as 42702: "column reference \"player_id\"
-- is ambiguous", followed by 42702 again on the ON CONFLICT clause
-- which can't be qualified with a table alias).
--
-- Fix: add `#variable_conflict use_column` so PL/pgSQL always resolves
-- ambiguous names to the table column. The OUT variables are still
-- populated explicitly via RETURN QUERY SELECT — they're never
-- referenced by name in the body — so this is fully safe.
-- =====================================================================

create or replace function public.verify_player_pin_v2(
  input_pin text, input_device_id text, input_user_agent text default null
) returns table (player_id uuid, is_new_device boolean, trusted boolean, status text)
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
#variable_conflict use_column
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
  select count(*) into v_failures_24h from public.pin_attempts pa
   where pa.device_id = input_device_id and pa.succeeded = false and pa.attempt_kind = 'player'
     and pa.attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'rate_limited'::text; return;
  end if;

  -- PIN match (alias players as p so p.status doesn't shadow the OUT column `status`)
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
      select count(*) into v_failures_since_ok from public.pin_attempts pa
       where pa.device_id = input_device_id and pa.player_id = v_attached_player
         and pa.succeeded = false and pa.attempt_kind = 'player'
         and pa.attempted_at > coalesce(
           (select max(pa2.attempted_at) from public.pin_attempts pa2
             where pa2.device_id = input_device_id and pa2.player_id = v_attached_player
               and pa2.succeeded = true and pa2.attempt_kind = 'player'),
           '1900-01-01'::timestamptz);
      if v_failures_since_ok >= c_strikes_known_dev then
        update public.players set locked_until = now() + c_lockout where id = v_attached_player;
      end if;
    end if;
    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;

  -- RIGHT PIN, locked?
  if exists (select 1 from public.players p where p.id = v_player_id and p.locked_until is not null and p.locked_until > now()) then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_player_id, input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'locked'::text; return;
  end if;

  -- RIGHT PIN, not locked: succeed. Upsert device row.
  v_is_known_device := exists (
    select 1 from public.player_devices pd
     where pd.player_id = v_player_id and pd.device_id = input_device_id);

  insert into public.player_devices(player_id, device_id, user_agent)
  values (v_player_id, input_device_id, input_user_agent)
  on conflict (player_id, device_id) do update set last_seen = now(), user_agent = excluded.user_agent;

  -- Grace window auto-trust
  select count(*) into v_existing_trusted_count from public.player_devices pd
   where pd.player_id = v_player_id and pd.trusted_at is not null;
  if v_existing_trusted_count = 0 then
    select s.auto_trust_until into v_auto_trust_until from public.settings s where s.id = 1 limit 1;
    if v_auto_trust_until is not null and v_auto_trust_until > now() then
      update public.player_devices pd set trusted_at = now()
       where pd.player_id = v_player_id and pd.device_id = input_device_id;
    end if;
  end if;

  -- Read final trust state
  select pd.trusted_at is not null into v_is_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;

  -- Successful login clears any prior lockout
  update public.players set locked_until = null where id = v_player_id;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded, was_new_device)
  values (v_player_id, input_device_id, input_user_agent, 'player', true, not v_is_known_device);

  return query select v_player_id, not v_is_known_device, coalesce(v_is_trusted, false), 'ok'::text;
end $$;
