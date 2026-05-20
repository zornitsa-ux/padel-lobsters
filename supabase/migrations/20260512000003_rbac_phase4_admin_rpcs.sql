-- RBAC Phase 4: rewrite all admin RPCs to use session-based auth
--
-- Removes input_admin_pin from every admin RPC signature.
-- Replaces verify_admin_pin / verify_admin_pin_v2 guards with:
--   perform public.require_admin();
-- which reads auth.uid() from the bearer JWT and checks players.role = 'admin'.
--
-- Requires Phase 1 (players.role column) and Phase 3 (require_admin function)
-- to have been applied first.
--
-- Also fixes two bugs:
--   admin_add_player:    now writes pin_hash as well as pin
--   admin_regenerate_pin: now writes pin_hash as well as pin
--
-- Drops admin_change_pin: the shared admin PIN concept is gone after Phase 4.
-- The private.admin_secrets table and verify_admin_pin(_v2) functions will be
-- cleaned up in Phase 6 once Phase 4+5 are confirmed stable in production.

-- ---------------------------------------------------------------------------
-- Drop legacy shared-PIN rotation RPC
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_change_pin(text, text, text, text);

-- ---------------------------------------------------------------------------
-- admin_add_player
-- Fixes pin_hash bug: now bcrypt-hashes the generated PIN.
-- Audit log uses auth.uid() for the acting admin.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_add_player(
  input_payload jsonb
)
RETURNS SETOF players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
#variable_conflict use_column
DECLARE v_new_pin text; v_inserted public.players%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_payload IS NULL THEN RETURN; END IF;
  FOR i IN 1..10 LOOP
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.players p WHERE p.pin = v_new_pin AND coalesce(p.status,'active') = 'active'
    );
  END LOOP;
  INSERT INTO public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
    preferred_position, tagline_label, pin, pin_hash)
  VALUES (
    coalesce(input_payload->>'name', ''),
    coalesce(input_payload->>'email', ''),
    coalesce(input_payload->>'phone', ''),
    coalesce(input_payload->>'notes', ''),
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0) + coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce(input_payload->>'playtomic_username', ''),
    coalesce(input_payload->>'gender', ''),
    coalesce(input_payload->>'status', 'active'),
    coalesce((input_payload->>'is_left_handed')::boolean, false),
    coalesce(input_payload->>'country', ''),
    coalesce(input_payload->>'avatar_url', ''),
    nullif(input_payload->>'birthday', '')::date,
    coalesce(input_payload->>'preferred_position', ''),
    coalesce(input_payload->>'tagline_label', ''),
    v_new_pin,
    extensions.crypt(v_new_pin, extensions.gen_salt('bf', 10))
  ) RETURNING * INTO v_inserted;
  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (v_inserted.id, 'admin_action', true);
  IF v_inserted.email IS NOT NULL AND length(trim(v_inserted.email)) > 3 THEN
    PERFORM private.send_pin_email(v_inserted.id, v_new_pin, 'new_signup');
  END IF;
  RETURN NEXT v_inserted;
END $$;

-- ---------------------------------------------------------------------------
-- admin_approve_device
-- Device management RPC: keeps target player/device identifiers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_approve_device(
  input_target_player uuid,
  input_target_device text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE v_did_update boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_player IS NULL OR input_target_device IS NULL THEN RETURN 'denied'; END IF;
  WITH upd AS (
    UPDATE public.player_devices SET trusted_at = now()
     WHERE player_id = input_target_player AND device_id = input_target_device AND trusted_at IS NULL RETURNING 1
  ) SELECT EXISTS(SELECT 1 FROM upd) INTO v_did_update;
  IF NOT v_did_update THEN RETURN 'no_such_device'; END IF;
  INSERT INTO public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  VALUES (input_target_player, input_target_device, 'admin_action', true);
  RETURN 'ok';
END $$;

-- ---------------------------------------------------------------------------
-- admin_cancel_transfer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_cancel_transfer(
  input_transfer_id uuid
)
RETURNS TABLE(status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE v_xfer public.registration_transfers%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text; RETURN; END IF;
  IF v_xfer.status <> 'pending' THEN RETURN QUERY SELECT 'not_pending'::text; RETURN; END IF;
  UPDATE public.registration_transfers
     SET status = 'cancelled', closed_reason = 'admin_cancel', closed_at = now()
   WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'cancelled'::text;
END $$;

-- ---------------------------------------------------------------------------
-- admin_delete_player
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_player(
  input_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
#variable_conflict use_column
DECLARE v_did_delete boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_id IS NULL THEN RETURN false; END IF;
  WITH del AS (
    DELETE FROM public.players p WHERE p.id = input_target_id RETURNING 1
  ) SELECT EXISTS(SELECT 1 FROM del) INTO v_did_delete;
  IF v_did_delete THEN
    INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
    VALUES (input_target_id, 'admin_action', true);
  END IF;
  RETURN v_did_delete;
END $$;

-- ---------------------------------------------------------------------------
-- admin_delete_raffle_winner
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_raffle_winner(
  input_winner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  PERFORM public.require_admin();
  DELETE FROM public.raffle_winners WHERE id = input_winner_id;
  RETURN true;
END $$;

-- ---------------------------------------------------------------------------
-- admin_deny_device
-- Device management RPC: keeps target player/device identifiers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_deny_device(
  input_target_player uuid,
  input_target_device text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE v_did_delete boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_player IS NULL OR input_target_device IS NULL THEN RETURN 'denied'; END IF;
  WITH del AS (
    DELETE FROM public.player_devices
     WHERE player_id = input_target_player AND device_id = input_target_device AND trusted_at IS NULL RETURNING 1
  ) SELECT EXISTS(SELECT 1 FROM del) INTO v_did_delete;
  IF NOT v_did_delete THEN RETURN 'no_such_device'; END IF;
  INSERT INTO public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  VALUES (input_target_player, input_target_device, 'admin_action', false);
  RETURN 'ok';
END $$;

-- ---------------------------------------------------------------------------
-- admin_force_accept_transfer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_force_accept_transfer(
  input_transfer_id uuid
)
RETURNS TABLE(status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE v_xfer public.registration_transfers%rowtype; v_started boolean;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text; RETURN; END IF;
  IF v_xfer.status <> 'pending' THEN RETURN QUERY SELECT 'not_pending'::text; RETURN; END IF;
  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  IF coalesce(v_started, true) THEN
    UPDATE public.registration_transfers
       SET status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     WHERE id = v_xfer.id;
    RETURN QUERY SELECT 'tournament_started'::text; RETURN;
  END IF;
  UPDATE public.registrations
     SET status = 'cancelled', payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   WHERE tournament_id = v_xfer.tournament_id AND player_id = v_xfer.from_player_id AND status = 'registered';
  INSERT INTO public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  VALUES (v_xfer.tournament_id, v_xfer.to_player_id, 'registered', 'transferred',
    'transferred_from:' || v_xfer.from_player_id::text);
  UPDATE public.registration_transfers
     SET status = 'accepted', responded_at = now(), closed_reason = 'admin_force_accept', closed_at = now()
   WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'accepted'::text;
END $$;

-- ---------------------------------------------------------------------------
-- admin_list_pending_devices
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_pending_devices()
RETURNS TABLE(player_id uuid, player_name text, device_id text, user_agent text, first_seen timestamp with time zone, last_seen timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  RETURN QUERY SELECT p.id, p.name, pd.device_id, pd.user_agent, pd.first_seen, pd.last_seen
    FROM public.player_devices pd JOIN public.players p ON p.id = pd.player_id
    WHERE pd.trusted_at IS NULL ORDER BY pd.first_seen DESC;
END $$;

-- ---------------------------------------------------------------------------
-- admin_list_security_events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_security_events(
  input_limit integer DEFAULT 100
)
RETURNS TABLE(id bigint, player_id uuid, player_name text, device_id text, user_agent text, attempt_kind text, succeeded boolean, was_new_device boolean, attempted_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  RETURN QUERY SELECT pa.id, pa.player_id, p.name, pa.device_id, pa.user_agent, pa.attempt_kind, pa.succeeded, pa.was_new_device, pa.attempted_at
    FROM public.pin_attempts pa LEFT JOIN public.players p ON p.id = pa.player_id
    ORDER BY pa.attempted_at DESC LIMIT greatest(1, least(input_limit, 500));
END $$;

-- ---------------------------------------------------------------------------
-- admin_persist_learned_ratings
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_persist_learned_ratings(
  input_updates jsonb,
  input_applied_tournament_ids uuid[] DEFAULT '{}'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_updated_count int         := 0;
  v_now           timestamptz := now();
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_updates IS NULL OR jsonb_typeof(input_updates) <> 'array' THEN RETURN 0; END IF;

  WITH src AS (
    SELECT
      (e->>'id')::uuid                                                   AS id,
      coalesce((e->>'learned_rating')::numeric, 1500)                    AS learned_rating,
      coalesce((e->>'learned_rd')::numeric, 350)                         AS learned_rd,
      coalesce((e->>'learned_volatility')::numeric, 0.06)                AS learned_volatility,
      coalesce((e->>'learned_matches_count')::int, 0)                    AS learned_matches_count,
      coalesce(nullif(e->>'learned_updated_at','')::timestamptz, v_now)  AS learned_updated_at
    FROM jsonb_array_elements(input_updates) AS e
  )
  UPDATE public.players p
     SET learned_rating        = src.learned_rating,
         learned_rd            = src.learned_rd,
         learned_volatility    = src.learned_volatility,
         learned_matches_count = src.learned_matches_count,
         learned_updated_at    = src.learned_updated_at
    FROM src
   WHERE p.id = src.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF input_applied_tournament_ids IS NOT NULL
     AND array_length(input_applied_tournament_ids, 1) > 0 THEN
    UPDATE public.tournaments
       SET ratings_applied_at = v_now
     WHERE id = ANY(input_applied_tournament_ids);
  END IF;

  RETURN v_updated_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_record_raffle_winners
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_record_raffle_winners(
  input_tournament_id uuid,
  input_player_ids uuid[],
  input_prizes text[] DEFAULT NULL
)
RETURNS SETOF raffle_winners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_t_date  date;
  v_t_name  text;
  v_pid     uuid;
  v_prize   text;
  v_idx     int;
  v_row     public.raffle_winners%rowtype;
BEGIN
  SET LOCAL statement_timeout = '15s';
  PERFORM public.require_admin();
  IF input_tournament_id IS NULL OR input_player_ids IS NULL THEN RETURN; END IF;

  SELECT date, name INTO v_t_date, v_t_name
    FROM public.tournaments WHERE id = input_tournament_id;
  IF v_t_date IS NULL THEN RETURN; END IF;

  v_idx := 1;
  FOREACH v_pid IN ARRAY input_player_ids LOOP
    v_prize := null;
    IF input_prizes IS NOT NULL AND v_idx <= array_length(input_prizes, 1) THEN
      v_prize := input_prizes[v_idx];
    END IF;
    v_idx := v_idx + 1;

    IF EXISTS (
      SELECT 1 FROM public.raffle_winners
       WHERE player_id = v_pid AND tournament_id = input_tournament_id
    ) THEN CONTINUE; END IF;

    INSERT INTO public.raffle_winners
      (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
    VALUES
      (v_pid, input_tournament_id, v_t_date, v_t_name, 0, v_prize)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- admin_regenerate_pin
-- Fixes pin_hash bug: now bcrypt-hashes the regenerated PIN.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_regenerate_pin(
  input_target_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
#variable_conflict use_column
DECLARE v_new_pin text; v_updated boolean := false; v_email text;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_id IS NULL THEN RETURN null; END IF;
  FOR i IN 1..10 LOOP
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.players p WHERE p.pin = v_new_pin AND p.id <> input_target_id AND coalesce(p.status,'active') = 'active'
    );
  END LOOP;
  WITH upd AS (
    UPDATE public.players p
       SET pin = v_new_pin,
           pin_hash = extensions.crypt(v_new_pin, extensions.gen_salt('bf', 10))
     WHERE p.id = input_target_id
     RETURNING p.email
  ) SELECT email INTO v_email FROM upd;
  v_updated := v_email IS DISTINCT FROM null OR v_email IS NULL AND EXISTS (
    SELECT 1 FROM public.players WHERE id = input_target_id
  );
  IF NOT v_updated THEN RETURN null; END IF;
  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (input_target_id, 'admin_action', true);
  IF v_email IS NOT NULL AND length(trim(v_email)) > 3 THEN
    PERFORM private.send_pin_email(input_target_id, v_new_pin, 'regenerated');
  END IF;
  RETURN v_new_pin;
END $$;

-- ---------------------------------------------------------------------------
-- admin_unlock_player
-- Removes input_admin_device_id (was only used for audit logging).
-- Keeps input_target_device (may be used to simultaneously trust the device).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_unlock_player(
  input_target_player uuid,
  input_target_device text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_player IS NULL THEN RETURN 'denied'; END IF;
  UPDATE public.players SET locked_until = null WHERE id = input_target_player;
  IF input_target_device IS NOT NULL THEN
    INSERT INTO public.player_devices(player_id, device_id, trusted_at)
    VALUES (input_target_player, input_target_device, now())
    ON CONFLICT (player_id, device_id) DO UPDATE
      SET trusted_at = coalesce(public.player_devices.trusted_at, now());
  END IF;
  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (input_target_player, 'admin_unlock', true);
  RETURN 'ok';
END $$;

-- ---------------------------------------------------------------------------
-- admin_update_player
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_player(
  input_target_id uuid,
  input_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
#variable_conflict use_column
DECLARE v_updated boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_id IS NULL OR input_payload IS NULL THEN RETURN false; END IF;
  WITH upd AS (
    UPDATE public.players p SET
      name = coalesce(input_payload->>'name', p.name),
      email = coalesce(input_payload->>'email', p.email),
      phone = coalesce(input_payload->>'phone', p.phone),
      notes = coalesce(input_payload->>'notes', p.notes),
      playtomic_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjustment = coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      adjusted_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level)
                      + coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      playtomic_username = coalesce(input_payload->>'playtomic_username', p.playtomic_username),
      gender = coalesce(input_payload->>'gender', p.gender),
      status = coalesce(input_payload->>'status', p.status),
      is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      country = coalesce(input_payload->>'country', p.country),
      avatar_url = coalesce(input_payload->>'avatar_url', p.avatar_url),
      birthday = coalesce(nullif(input_payload->>'birthday', '')::date, p.birthday),
      preferred_position = coalesce(input_payload->>'preferred_position', p.preferred_position),
      tagline = coalesce(input_payload->>'tagline', p.tagline),
      tagline_label = coalesce(input_payload->>'tagline_label', p.tagline_label),
      playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
    WHERE p.id = input_target_id RETURNING 1
  ) SELECT EXISTS(SELECT 1 FROM upd) INTO v_updated;
  IF v_updated THEN
    INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
    VALUES (input_target_id, 'admin_action', true);
  END IF;
  RETURN v_updated;
END $$;

-- ---------------------------------------------------------------------------
-- admin_update_raffle_winner_prize
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_raffle_winner_prize(
  input_winner_id uuid,
  input_prize text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  PERFORM public.require_admin();
  UPDATE public.raffle_winners
     SET prize = nullif(trim(coalesce(input_prize, '')), '')
   WHERE id = input_winner_id;
  RETURN FOUND;
END $$;

-- ---------------------------------------------------------------------------
-- get_all_players_with_pii_v2
-- Removes PIN params. PII dump rate limit now uses auth.uid() as player_id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_all_players_with_pii_v2()
RETURNS SETOF players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_dumps_today int;
  c_max_dumps_24h constant int := 3;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT count(*) INTO v_dumps_today FROM public.pin_attempts
   WHERE player_id = auth.uid()
     AND attempt_kind = 'pii_dump'
     AND succeeded = true
     AND attempted_at > now() - interval '24 hours';
  IF v_dumps_today >= c_max_dumps_24h THEN
    INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
    VALUES (auth.uid(), 'pii_dump', false);
    RETURN;
  END IF;
  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (auth.uid(), 'pii_dump', true);
  RETURN QUERY SELECT * FROM public.players ORDER BY name;
END $$;

-- ---------------------------------------------------------------------------
-- Lobster Oscars admin RPCs
-- All preserve SET search_path TO 'public' (not pg_catalog/extensions).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_end(
  input_tournament_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_started_at TIMESTAMPTZ; v_closed_at TIMESTAMPTZ;
BEGIN
  PERFORM public.require_admin();
  SELECT s.started_at, s.closed_at INTO v_started_at, v_closed_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'already_ended'; END IF;
  UPDATE public.lobster_oscars_sessions SET closed_at = now() WHERE tournament_id = input_tournament_id;
  RETURN 'ended';
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_category_voters(
  input_category_id uuid
)
RETURNS TABLE(player_id uuid, player_name text, voted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_tournament_id UUID;
BEGIN
  PERFORM public.require_admin();
  SELECT s.tournament_id INTO v_tournament_id
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_tournament_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.name,
           EXISTS(SELECT 1 FROM public.lobster_oscars_votes v WHERE v.category_id = input_category_id AND v.voter_id = p.id) AS voted
      FROM public.players p
      JOIN public.registrations r ON r.player_id = p.id
     WHERE r.tournament_id = v_tournament_id AND r.status = 'registered'
     ORDER BY EXISTS(SELECT 1 FROM public.lobster_oscars_votes v
                      WHERE v.category_id = input_category_id AND v.voter_id = p.id) DESC, p.name ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_results(
  input_tournament_id uuid
)
RETURNS TABLE(category_id uuid, category_name text, category_icon text, display_order integer, target_id uuid, target_name text, votes_count bigint, rank_in_category bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_session_id UUID; v_started_at TIMESTAMPTZ;
BEGIN
  PERFORM public.require_admin();
  SELECT s.id, s.started_at INTO v_session_id, v_started_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL OR v_started_at IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH counts AS (
    SELECT c.id AS cat_id, c.name AS cat_name, c.icon AS cat_icon, c.display_order AS cat_order,
           v.target_id AS tgt_id, p.name AS tgt_name, count(*)::BIGINT AS vc
      FROM public.lobster_oscars_categories c
      JOIN public.lobster_oscars_votes v ON v.category_id = c.id
      JOIN public.players p ON p.id = v.target_id
     WHERE c.session_id = v_session_id
     GROUP BY c.id, c.name, c.icon, c.display_order, v.target_id, p.name
  ), ranked AS (
    SELECT counts.*, rank() OVER (PARTITION BY cat_id ORDER BY vc DESC) AS rk FROM counts
  )
  SELECT cat_id, cat_name, cat_icon, cat_order, tgt_id, tgt_name, vc, rk
    FROM ranked ORDER BY cat_order, rk, tgt_name;
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_session(
  input_tournament_id uuid
)
RETURNS TABLE(session_id uuid, tournament_id uuid, started_at timestamp with time zone, closed_at timestamp with time zone, shared_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY SELECT s.id, s.tournament_id, s.started_at, s.closed_at, s.shared_at, s.created_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_stats(
  input_tournament_id uuid
)
RETURNS TABLE(category_id uuid, category_name text, category_icon text, display_order integer, votes_count bigint, total_participants bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_session_id UUID; v_total_participants BIGINT;
BEGIN
  PERFORM public.require_admin();
  SELECT s.id INTO v_session_id FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_total_participants FROM public.registrations r
   WHERE r.tournament_id = input_tournament_id AND r.status = 'registered';
  RETURN QUERY
    SELECT c.id, c.name, c.icon, c.display_order, COALESCE(vc.cnt, 0::BIGINT), v_total_participants
      FROM public.lobster_oscars_categories c
      LEFT JOIN (SELECT v.category_id, count(*) AS cnt FROM public.lobster_oscars_votes v GROUP BY v.category_id) vc
        ON vc.category_id = c.id
     WHERE c.session_id = v_session_id ORDER BY c.display_order;
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_share(
  input_tournament_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_closed_at TIMESTAMPTZ; v_shared_at TIMESTAMPTZ;
BEGIN
  PERFORM public.require_admin();
  SELECT s.closed_at, s.shared_at INTO v_closed_at, v_shared_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_closed_at IS NULL THEN RETURN 'not_ended'; END IF;
  IF v_shared_at IS NOT NULL THEN RETURN 'already_shared'; END IF;
  UPDATE public.lobster_oscars_sessions SET shared_at = now() WHERE tournament_id = input_tournament_id;
  RETURN 'shared';
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_start(
  input_tournament_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_session_id UUID; v_started_at TIMESTAMPTZ; v_cat_count INTEGER;
BEGIN
  PERFORM public.require_admin();
  SELECT s.id, s.started_at INTO v_session_id, v_started_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN 'no_session'; END IF;
  IF v_started_at IS NOT NULL THEN RETURN 'already_started'; END IF;
  SELECT count(*) INTO v_cat_count FROM public.lobster_oscars_categories WHERE session_id = v_session_id;
  IF v_cat_count = 0 THEN RETURN 'no_categories'; END IF;
  UPDATE public.lobster_oscars_sessions SET started_at = now() WHERE id = v_session_id;
  RETURN 'started';
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_upsert_categories(
  input_tournament_id uuid,
  input_categories jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_session_id UUID; v_started_at TIMESTAMPTZ;
BEGIN
  PERFORM public.require_admin();
  IF input_categories IS NULL OR jsonb_typeof(input_categories) <> 'array' OR jsonb_array_length(input_categories) < 1 THEN
    RETURN 'empty_categories';
  END IF;
  SELECT s.id, s.started_at INTO v_session_id, v_started_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN
    INSERT INTO public.lobster_oscars_sessions (tournament_id) VALUES (input_tournament_id) RETURNING id INTO v_session_id;
  ELSIF v_started_at IS NOT NULL THEN RETURN 'already_started'; END IF;
  DELETE FROM public.lobster_oscars_categories WHERE session_id = v_session_id;
  INSERT INTO public.lobster_oscars_categories (session_id, name, icon, display_order)
    SELECT v_session_id,
           COALESCE(NULLIF(btrim(elem->>'name'), ''), 'Untitled'),
           COALESCE(NULLIF(btrim(elem->>'icon'), ''), '🦞'),
           COALESCE((elem->>'display_order')::INTEGER, (ord - 1)::INTEGER)
      FROM jsonb_array_elements(input_categories) WITH ORDINALITY AS arr(elem, ord);
  RETURN 'ok';
END; $$;
