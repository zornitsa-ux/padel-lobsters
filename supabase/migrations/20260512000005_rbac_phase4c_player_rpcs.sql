-- RBAC Phase 4c: rewrite player-PIN RPCs to use auth.uid()
--
-- Removes input_pin / input_device_id / input_user_agent from all 12 player-facing
-- RPCs and replaces verify_player_pin* calls with auth.uid(). The trusted-device
-- check (player_devices.trusted_at IS NOT NULL) is also dropped — an active
-- Supabase session is the trust signal.

-- ─── approve_device ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_device(
  input_requesting_device_id text,
  input_target_device_id text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_player_id uuid;
  v_target_exists boolean;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  IF input_requesting_device_id IS NULL OR input_target_device_id IS NULL THEN
    RETURN 'denied';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.player_devices
     WHERE player_id = v_player_id AND device_id = input_target_device_id
  ) INTO v_target_exists;
  IF NOT v_target_exists THEN RETURN 'no_such_device'; END IF;
  UPDATE public.player_devices
     SET trusted_at = now()
   WHERE player_id = v_player_id
     AND device_id = input_target_device_id
     AND trusted_at IS NULL;
  INSERT INTO public.pin_attempts (player_id, device_id, attempt_kind, succeeded, was_new_device)
  VALUES (v_player_id, input_target_device_id, 'approve_device', true, false);
  RETURN 'ok';
END
$function$;

-- ─── reject_device ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_device(
  input_requesting_device_id text,
  input_target_device_id text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_player_id uuid;
  v_target_exists boolean;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  IF input_requesting_device_id IS NULL OR input_target_device_id IS NULL THEN
    RETURN 'denied';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.player_devices pd2
     WHERE pd2.player_id = v_player_id
       AND pd2.device_id = input_target_device_id
       AND pd2.trusted_at IS NULL
  ) INTO v_target_exists;
  IF NOT v_target_exists THEN RETURN 'no_such_device'; END IF;
  DELETE FROM public.player_devices pd
   WHERE pd.player_id = v_player_id
     AND pd.device_id = input_target_device_id
     AND pd.trusted_at IS NULL;
  INSERT INTO public.pin_attempts (player_id, device_id, attempt_kind, succeeded, was_new_device)
  VALUES (v_player_id, input_target_device_id, 'approve_device', false, false);
  RETURN 'ok';
END
$function$;

-- ─── list_pending_devices ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_pending_devices(
  input_requesting_device_id text
)
RETURNS TABLE (device_id text, user_agent text, first_seen timestamptz, last_seen timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_player_id uuid;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  RETURN QUERY
    SELECT pd.device_id, pd.user_agent, pd.first_seen, pd.last_seen
      FROM public.player_devices pd
     WHERE pd.player_id = v_player_id
       AND pd.trusted_at IS NULL
     ORDER BY pd.first_seen DESC;
END
$function$;

-- ─── get_my_profile_v2 ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_profile_v2()
RETURNS SETOF players
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_player_id uuid;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  RETURN QUERY SELECT * FROM public.players WHERE id = v_player_id;
END
$function$;

-- ─── update_my_profile ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_my_profile(input_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_player_id uuid;
  v_updated boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL OR input_payload IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  WITH upd AS (
    UPDATE public.players p SET
      name                  = coalesce(input_payload->>'name',                  p.name),
      email                 = coalesce(input_payload->>'email',                 p.email),
      phone                 = coalesce(input_payload->>'phone',                 p.phone),
      birthday              = coalesce(nullif(input_payload->>'birthday', '')::date, p.birthday),
      country               = coalesce(input_payload->>'country',               p.country),
      gender                = coalesce(input_payload->>'gender',                p.gender),
      is_left_handed        = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      preferred_position    = coalesce(input_payload->>'preferred_position',    p.preferred_position),
      playtomic_level       = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjusted_level        = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level) + p.adjustment,
      playtomic_username    = coalesce(input_payload->>'playtomic_username',    p.playtomic_username),
      tagline               = coalesce(input_payload->>'tagline',               p.tagline),
      tagline_label         = coalesce(input_payload->>'tagline_label',         p.tagline_label),
      avatar_url            = coalesce(input_payload->>'avatar_url',            p.avatar_url),
      playtomic_updated_at  = CASE WHEN (input_payload ? 'playtomic_level')
                                   THEN now()
                                   ELSE p.playtomic_updated_at END
    WHERE p.id = v_player_id
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM upd) INTO v_updated;
  RETURN v_updated;
END
$function$;

-- ─── create_transfer ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_transfer(
  input_to_player_id uuid,
  input_tournament_id uuid
)
RETURNS TABLE (transfer_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER
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

-- ─── cancel_transfer ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_transfer(input_transfer_id uuid)
RETURNS TABLE (status text)
LANGUAGE plpgsql SECURITY DEFINER
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

-- ─── respond_to_transfer ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_transfer(
  input_transfer_id uuid,
  input_accept boolean
)
RETURNS TABLE (status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_to_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
  v_started boolean;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_to_player_id := auth.uid();
  IF v_to_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text; RETURN; END IF;
  IF v_xfer.to_player_id <> v_to_player_id THEN RETURN QUERY SELECT 'forbidden'::text; RETURN; END IF;
  IF v_xfer.status <> 'pending' THEN RETURN QUERY SELECT 'not_pending'::text; RETURN; END IF;
  IF input_accept IS NOT TRUE THEN
    UPDATE public.registration_transfers SET status = 'declined', responded_at = now() WHERE id = v_xfer.id;
    RETURN QUERY SELECT 'declined'::text; RETURN;
  END IF;
  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  IF coalesce(v_started, true) THEN
    UPDATE public.registration_transfers
       SET status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     WHERE id = v_xfer.id;
    RETURN QUERY SELECT 'tournament_started'::text; RETURN;
  END IF;
  UPDATE public.registrations
     SET status = 'cancelled',
         payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   WHERE tournament_id = v_xfer.tournament_id
     AND player_id = v_xfer.from_player_id
     AND status = 'registered';
  INSERT INTO public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  VALUES (
    v_xfer.tournament_id,
    v_xfer.to_player_id,
    'registered',
    'transferred',
    'transferred_from:' || v_xfer.from_player_id::text
  );
  UPDATE public.registration_transfers SET status = 'accepted', responded_at = now() WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'accepted'::text;
END
$function$;

-- ─── get_transfer_recipient_phone ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_transfer_recipient_phone(input_transfer_id uuid)
RETURNS TABLE (name text, phone text, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_from_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
  v_target_name text;
  v_target_phone text;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_from_player_id := auth.uid();
  IF v_from_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id;
  IF NOT FOUND THEN RETURN QUERY SELECT null::text, null::text, 'not_found'::text; RETURN; END IF;
  IF v_xfer.from_player_id <> v_from_player_id THEN
    RETURN QUERY SELECT null::text, null::text, 'forbidden'::text; RETURN;
  END IF;
  IF v_xfer.status <> 'pending' THEN
    RETURN QUERY SELECT null::text, null::text, 'not_pending'::text; RETURN;
  END IF;
  SELECT p.name, p.phone INTO v_target_name, v_target_phone
    FROM public.players p WHERE p.id = v_xfer.to_player_id;
  RETURN QUERY SELECT v_target_name, v_target_phone, 'ok'::text;
END
$function$;

-- ─── lobster_oscars_cast_vote ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lobster_oscars_cast_vote(
  input_category_id uuid,
  input_target_id uuid
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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

-- ─── lobster_oscars_clear_vote ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lobster_oscars_clear_vote(input_category_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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

-- ─── lobster_oscars_get_my_votes ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lobster_oscars_get_my_votes(input_tournament_id uuid)
RETURNS TABLE (category_id uuid, target_id uuid, target_name text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_voter_id uuid;
  v_session_id uuid;
BEGIN
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  SELECT s.id INTO v_session_id
    FROM public.lobster_oscars_sessions s
   WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT v.category_id, v.target_id, p.name, v.updated_at
      FROM public.lobster_oscars_votes v
      JOIN public.lobster_oscars_categories c ON c.id = v.category_id
      JOIN public.players p ON p.id = v.target_id
     WHERE c.session_id = v_session_id AND v.voter_id = v_voter_id
     ORDER BY c.display_order;
END
$function$;
