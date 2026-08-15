-- Remove the probationary device-trust system in its entirety: the
-- player_devices table, require_trusted_device() and its five guarded RPCs,
-- the approve/reject flow, the device_trusted JWT claim, the account lockout
-- that depended on it, and the new-device signal. See
-- docs/device-trust-removal/DECISIONS.md for the full rationale (D-1..D-9).

-- ============================================================================
-- §1 — Re-create the five guarded RPCs without the require_trusted_device() guard.
-- Bodies dumped live via pg_get_functiondef; only the PERFORM line is removed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_transfer(input_transfer_id uuid)
 RETURNS TABLE(status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text; RETURN; END IF;
  IF v_xfer.from_player_id <> v_player_id THEN RETURN QUERY SELECT 'forbidden'::text; RETURN; END IF;
  IF v_xfer.status <> 'pending' THEN RETURN QUERY SELECT 'not_pending'::text; RETURN; END IF;
  UPDATE public.registration_transfers
     SET status = 'cancelled', closed_reason = 'from_player_cancel', closed_at = now()
   WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'cancelled'::text;
END
$function$;

CREATE OR REPLACE FUNCTION public.create_transfer(input_to_player_id uuid, input_tournament_id uuid)
 RETURNS TABLE(transfer_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_from_player_id uuid;
  v_target_status text;
  v_existing_pending uuid;
  v_started boolean;
  v_new_id uuid;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_from_player_id := auth.uid();
  IF v_from_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  IF input_to_player_id IS NULL OR input_to_player_id = v_from_player_id THEN
    RETURN QUERY SELECT null::uuid, 'invalid_target'::text; RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = input_to_player_id AND coalesce(p.status, 'active') = 'active'
  ) THEN
    RETURN QUERY SELECT null::uuid, 'invalid_target'::text; RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.registrations r
     WHERE r.tournament_id = input_tournament_id
       AND r.player_id = v_from_player_id
       AND r.status = 'registered'
  ) THEN
    RETURN QUERY SELECT null::uuid, 'not_registered'::text; RETURN;
  END IF;
  SELECT r.status INTO v_target_status
    FROM public.registrations r
   WHERE r.tournament_id = input_tournament_id
     AND r.player_id = input_to_player_id
     AND r.status = 'registered'
   LIMIT 1;
  IF v_target_status = 'registered' THEN
    RETURN QUERY SELECT null::uuid, 'target_already_registered'::text; RETURN;
  END IF;
  v_started := public.tournament_start_ts(input_tournament_id) <= now();
  IF coalesce(v_started, true) THEN
    RETURN QUERY SELECT null::uuid, 'tournament_started'::text; RETURN;
  END IF;
  SELECT rt.id INTO v_existing_pending
    FROM public.registration_transfers rt
   WHERE rt.tournament_id = input_tournament_id
     AND rt.from_player_id = v_from_player_id
     AND rt.status = 'pending'
   LIMIT 1;
  IF v_existing_pending IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_pending, 'already_pending'::text; RETURN;
  END IF;
  INSERT INTO public.registration_transfers (tournament_id, from_player_id, to_player_id)
  VALUES (input_tournament_id, v_from_player_id, input_to_player_id)
  RETURNING id INTO v_new_id;
  RETURN QUERY SELECT v_new_id, 'ok'::text;
END
$function$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_cast_vote(input_category_id uuid, input_target_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_voter_id uuid;
  v_session_id uuid;
  v_tournament_id uuid;
  v_started_at timestamptz;
  v_closed_at timestamptz;
  v_voter_registered boolean;
  v_target_registered boolean;
  v_existed boolean;
BEGIN
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  IF v_voter_id = input_target_id THEN RETURN 'self_vote'; END IF;
  SELECT c.session_id, s.tournament_id, s.started_at, s.closed_at
    INTO v_session_id, v_tournament_id, v_started_at, v_closed_at
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_session_id IS NULL THEN RETURN 'invalid_category'; END IF;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
     WHERE r.tournament_id = v_tournament_id
       AND r.player_id = v_voter_id
       AND r.status = 'registered'
  ) INTO v_voter_registered;
  IF NOT v_voter_registered THEN RETURN 'voter_not_registered'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
     WHERE r.tournament_id = v_tournament_id
       AND r.player_id = input_target_id
       AND r.status = 'registered'
  ) INTO v_target_registered;
  IF NOT v_target_registered THEN RETURN 'invalid_target'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.lobster_oscars_votes
     WHERE category_id = input_category_id AND voter_id = v_voter_id
  ) INTO v_existed;
  INSERT INTO public.lobster_oscars_votes (category_id, voter_id, target_id)
  VALUES (input_category_id, v_voter_id, input_target_id)
  ON CONFLICT (category_id, voter_id) DO UPDATE
    SET target_id = EXCLUDED.target_id, updated_at = now();
  RETURN CASE WHEN v_existed THEN 'updated' ELSE 'voted' END;
END
$function$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_clear_vote(input_category_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_voter_id uuid;
  v_session_id uuid;
  v_started_at timestamptz;
  v_closed_at timestamptz;
  v_deleted integer;
BEGIN
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  SELECT c.session_id, s.started_at, s.closed_at
    INTO v_session_id, v_started_at, v_closed_at
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_session_id IS NULL THEN RETURN 'invalid_category'; END IF;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  WITH d AS (
    DELETE FROM public.lobster_oscars_votes
     WHERE category_id = input_category_id AND voter_id = v_voter_id
    RETURNING 1
  ) SELECT count(*) INTO v_deleted FROM d;
  IF v_deleted = 0 THEN RETURN 'no_vote'; END IF;
  RETURN 'cleared';
END
$function$;

CREATE OR REPLACE FUNCTION public.update_my_profile(input_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_player_id     uuid;
  v_old_level     numeric;
  v_old_mm        numeric;
  v_old_sigma     numeric;
  v_new_level     numeric;
  v_level_changed boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL OR input_payload IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;

  SELECT playtomic_level, mm_rating, mm_sigma
    INTO v_old_level, v_old_mm, v_old_sigma
    FROM public.players WHERE id = v_player_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     AND v_new_level IS DISTINCT FROM v_old_level;

  UPDATE public.players p SET
    name               = CASE WHEN input_payload ? 'name'               THEN nullif(btrim(input_payload->>'name'), '')               ELSE p.name END,
    -- email is INTENTIONALLY OMITTED — self-service change routes through supabase.auth.updateUser.
    phone              = CASE WHEN input_payload ? 'phone'              THEN nullif(btrim(input_payload->>'phone'), '')              ELSE p.phone END,
    birthday           = CASE WHEN input_payload ? 'birthday'           THEN nullif(input_payload->>'birthday', '')::date            ELSE p.birthday END,
    country            = CASE WHEN input_payload ? 'country'            THEN nullif(btrim(input_payload->>'country'), '')            ELSE p.country END,
    gender             = CASE WHEN input_payload ? 'gender'             THEN nullif(btrim(input_payload->>'gender'), '')             ELSE p.gender END,
    is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
    preferred_position = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
    playtomic_level    = v_new_level,
    adjusted_level     = v_new_level,
    playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
    tagline            = CASE WHEN input_payload ? 'tagline'            THEN nullif(btrim(input_payload->>'tagline'), '')            ELSE p.tagline END,
    tagline_label      = CASE WHEN input_payload ? 'tagline_label'      THEN nullif(btrim(input_payload->>'tagline_label'), '')      ELSE p.tagline_label END,
    avatar_url         = CASE WHEN input_payload ? 'avatar_url'         THEN nullif(btrim(input_payload->>'avatar_url'), '')         ELSE p.avatar_url END,
    playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
  WHERE p.id = v_player_id;

  IF v_level_changed THEN
    PERFORM public.record_mm_reset(
      v_player_id, v_new_level,
      coalesce(v_old_mm, v_old_level), coalesce(v_old_sigma, 0.7), 'self_reset'
    );
  END IF;

  RETURN true;
END
$function$;

-- ============================================================================
-- §2 — custom_access_token_hook: role only, strip retired device claims.
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id  uuid;
  v_claims   jsonb;
  v_app_meta jsonb;
  v_role     text;
begin
  v_user_id  := (event->>'user_id')::uuid;
  v_claims   := event->'claims';
  -- Strip the retired device claims so pre-existing sessions stop carrying them
  -- forward on refresh.
  v_app_meta := coalesce(v_claims->'app_metadata', '{}'::jsonb) - 'device_trusted' - 'device_id';

  select role::text into v_role from public.players where id = v_user_id;
  if v_role is not null then
    v_app_meta := jsonb_set(v_app_meta, '{role}', to_jsonb(v_role));
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_meta);
  return jsonb_build_object('claims', v_claims);
end;
$function$;

-- ============================================================================
-- §3 — sync_my_role() replaces bootstrap_device_session.
-- ============================================================================

-- Magic-link / OAuth sign-ins mint a session before auth.users.raw_app_meta_data
-- carries the player's role, and the client reads role off session.user. This is
-- what bootstrap_device_session did besides registering the device; the device
-- half is gone, the role half is not optional.
create function public.sync_my_role()
returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid;
  v_role    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select role::text into v_role from public.players where id = v_user_id;
  if v_role is null then
    raise exception 'no player record for this user';
  end if;

  update auth.users
     set raw_app_meta_data =
           (coalesce(raw_app_meta_data, '{}'::jsonb) - 'device_trusted' - 'device_id')
           || jsonb_build_object('role', v_role)
   where id = v_user_id;

  return jsonb_build_object('role', v_role);
end;
$function$;

revoke execute on function public.sync_my_role() from public, anon;
grant  execute on function public.sync_my_role() to authenticated;

update auth.users
   set raw_app_meta_data = raw_app_meta_data - 'device_trusted' - 'device_id'
 where raw_app_meta_data ?| array['device_trusted', 'device_id'];

-- ============================================================================
-- §4 — verify_player_pin_v2: drop + recreate (return type changes).
-- ============================================================================

drop function if exists public.verify_player_pin_v2(text, text, text);

create function public.verify_player_pin_v2(
  input_pin        text,
  input_device_id  text,
  input_user_agent text default null
)
returns table (player_id uuid, status text)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_player_id    uuid;
  v_failures_24h int;
  c_max_per_device_24h constant int := 10;
begin
  set local statement_timeout = '30s';

  if input_pin is null or length(input_pin) < 4 or input_device_id is null then
    return query select null::uuid, 'wrong_pin'::text; return;
  end if;

  select count(*) into v_failures_24h
    from public.pin_attempts pa
   where pa.device_id = input_device_id
     and pa.succeeded = false
     and pa.attempt_kind = 'player'
     and pa.attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, 'rate_limited'::text; return;
  end if;

  select p.id into v_player_id
    from public.players p
   where p.pin_hash is not null
     and p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
     and coalesce(p.status, 'active') = 'active'
   limit 1;

  -- Wrong PIN: logged against the device only. Attributing the attempt to a
  -- player needed the device→player map in player_devices, which is gone.
  if v_player_id is null then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, 'wrong_pin'::text; return;
  end if;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_player_id, input_device_id, input_user_agent, 'player', true);

  return query select v_player_id, 'ok'::text;
end
$function$;

-- DROP removed every grant; restore exactly what 20260727194010 established.
revoke execute on function public.verify_player_pin_v2(text, text, text) from public, authenticated;
grant  execute on function public.verify_player_pin_v2(text, text, text) to anon;

-- ============================================================================
-- §5 — admin_list_security_events: drop + recreate without was_new_device.
-- ============================================================================

drop function if exists public.admin_list_security_events(integer);

create function public.admin_list_security_events(input_limit integer default 100)
returns table (
  id           bigint,
  player_id    uuid,
  player_name  text,
  device_id    text,
  user_agent   text,
  attempt_kind text,
  succeeded    boolean,
  attempted_at timestamptz
)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  return query
    select pa.id, pa.player_id, p.name, pa.device_id, pa.user_agent,
           pa.attempt_kind, pa.succeeded, pa.attempted_at
      from public.pin_attempts pa
      left join public.players p on p.id = pa.player_id
     order by pa.attempted_at desc
     limit greatest(1, least(input_limit, 500));
end
$function$;

revoke execute on function public.admin_list_security_events(integer) from public, anon;
grant  execute on function public.admin_list_security_events(integer) to authenticated;

-- ============================================================================
-- §6 — Drop the dead functions.
-- ============================================================================

drop function if exists public.require_trusted_device();
drop function if exists public.is_my_device_trusted(uuid, text);
drop function if exists public.approve_device(text, text);
drop function if exists public.reject_device(text, text);
drop function if exists public.list_pending_devices(text);
drop function if exists public.admin_approve_device(uuid, text);
drop function if exists public.admin_deny_device(uuid, text);
drop function if exists public.admin_list_pending_devices();
drop function if exists public.admin_unlock_player(uuid, text);
drop function if exists public.bootstrap_device_session(text);

-- ============================================================================
-- §7 — Drop the columns and the table.
-- ============================================================================

alter table public.pin_attempts drop column was_new_device;
alter table public.players      drop column locked_until;
alter table public.settings     drop column auto_trust_until;
drop table public.player_devices;
