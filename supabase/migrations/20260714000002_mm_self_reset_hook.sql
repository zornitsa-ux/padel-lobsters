-- Matchmaking V2 — M3.3: self-edit reset hook (D-002, D-008, D-018).
--
-- A playtomic_level edit re-anchors the learned prior: mm_rating := new level,
-- mm_sigma := 0.7 (SIGMA_PRIOR), logged as a rating_events row. update_my_profile
-- logs kind='self_reset'; admin_update_player logs kind='admin_edit' (D-008: an
-- admin level edit triggers the same reset semantics).
--
-- Both RPCs stop writing `adjustment` and drop the `+ adjustment` term, but keep
-- adjusted_level mirroring playtomic_level so legacy display stays faithful until
-- M4.3 drops the column and migrates its ~13 read sites (D-018). The self-
-- adjustment mechanism is otherwise gone (D-002): adjustment is no longer read.

-- ── shared reset + audit helper (internal to the two RPCs below) ──────────────
-- Sets mm_* to the re-anchored prior and inserts the audit row in one place.
-- applied_delta is the true movement of mm_rating (new level − prior mu).
-- Execute is revoked from all client roles; the SECURITY DEFINER callers run as
-- owner and reach it, direct client calls cannot (no mm_* tampering path).
CREATE OR REPLACE FUNCTION public.record_mm_reset(
  input_player_id   uuid,
  input_new_level   numeric,
  input_prior_mu    numeric,
  input_prior_sigma numeric,
  input_kind        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  UPDATE public.players
    SET mm_rating            = input_new_level,
        mm_sigma             = 0.7,
        mm_rating_updated_at = now()
    WHERE id = input_player_id;

  INSERT INTO public.rating_events (
    kind, tournament_id, player_id, prior_mu, prior_sigma,
    proposed_delta, applied_delta, flagged, review_status, breakdown
  ) VALUES (
    input_kind, NULL, input_player_id, input_prior_mu, input_prior_sigma,
    0, input_new_level - input_prior_mu, false, NULL, '[]'::jsonb
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.record_mm_reset(uuid, numeric, numeric, numeric, text)
  FROM anon, authenticated, public;

-- ── update_my_profile: self-edit resets the prior; no adjustment write ────────
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
  PERFORM public.require_trusted_device();

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

-- ── admin_update_player: strip adjustment; level edit resets the prior ────────
CREATE OR REPLACE FUNCTION public.admin_update_player(input_target_id uuid, input_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_old_level     numeric;
  v_old_mm        numeric;
  v_old_sigma     numeric;
  v_new_level     numeric;
  v_level_changed boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_id IS NULL OR input_payload IS NULL THEN RETURN false; END IF;

  SELECT playtomic_level, mm_rating, mm_sigma
    INTO v_old_level, v_old_mm, v_old_sigma
    FROM public.players WHERE id = input_target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     AND v_new_level IS DISTINCT FROM v_old_level;

  UPDATE public.players p SET
    name = CASE WHEN input_payload ? 'name' THEN nullif(btrim(input_payload->>'name'), '') ELSE p.name END,
    email = CASE WHEN input_payload ? 'email' THEN nullif(btrim(input_payload->>'email'), '') ELSE p.email END,
    phone = CASE WHEN input_payload ? 'phone' THEN nullif(btrim(input_payload->>'phone'), '') ELSE p.phone END,
    notes = CASE WHEN input_payload ? 'notes' THEN nullif(btrim(input_payload->>'notes'), '') ELSE p.notes END,
    playtomic_level = v_new_level,
    adjusted_level = v_new_level,
    playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
    gender = CASE WHEN input_payload ? 'gender' THEN nullif(btrim(input_payload->>'gender'), '') ELSE p.gender END,
    status = CASE WHEN input_payload ? 'status' THEN nullif(btrim(input_payload->>'status'), '') ELSE p.status END,
    is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
    country = CASE WHEN input_payload ? 'country' THEN nullif(btrim(input_payload->>'country'), '') ELSE p.country END,
    avatar_url = CASE WHEN input_payload ? 'avatar_url' THEN nullif(btrim(input_payload->>'avatar_url'), '') ELSE p.avatar_url END,
    birthday = CASE WHEN input_payload ? 'birthday' THEN nullif(input_payload->>'birthday', '')::date ELSE p.birthday END,
    preferred_position = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
    tagline = CASE WHEN input_payload ? 'tagline' THEN nullif(btrim(input_payload->>'tagline'), '') ELSE p.tagline END,
    tagline_label = CASE WHEN input_payload ? 'tagline_label' THEN nullif(btrim(input_payload->>'tagline_label'), '') ELSE p.tagline_label END,
    playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
  WHERE p.id = input_target_id;

  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (input_target_id, 'admin_action', true);

  IF v_level_changed THEN
    PERFORM public.record_mm_reset(
      input_target_id, v_new_level,
      coalesce(v_old_mm, v_old_level), coalesce(v_old_sigma, 0.7), 'admin_edit'
    );
  END IF;

  RETURN true;
END
$function$;
