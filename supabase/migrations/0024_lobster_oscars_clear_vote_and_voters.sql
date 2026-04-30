-- Lobster Oscars phase-3 RPCs:
--   • lobster_oscars_clear_vote — players can retract a vote
--   • lobster_oscars_admin_get_category_voters — admin sees who has voted in
--     a given category (binary voted/not-voted only, never the actual choice)

CREATE OR REPLACE FUNCTION public.lobster_oscars_clear_vote(
  input_pin TEXT, input_device_id TEXT, input_category_id UUID, input_user_agent TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voter_id UUID; v_pin_status TEXT;
  v_session_id UUID; v_started_at TIMESTAMPTZ; v_closed_at TIMESTAMPTZ;
  v_deleted INTEGER;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
    FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;
  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN RETURN 'invalid_pin'; END IF;

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
  )
  SELECT count(*) INTO v_deleted FROM d;
  IF v_deleted = 0 THEN RETURN 'no_vote'; END IF;
  RETURN 'cleared';
END; $$;
REVOKE EXECUTE ON FUNCTION public.lobster_oscars_clear_vote(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_clear_vote(TEXT, TEXT, UUID, TEXT) TO anon;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_category_voters(
  input_admin_pin TEXT, input_category_id UUID,
  input_device_id TEXT DEFAULT NULL, input_user_agent TEXT DEFAULT NULL
) RETURNS TABLE(player_id UUID, player_name TEXT, voted BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_admin BOOLEAN; v_tournament_id UUID;
BEGIN
  SELECT a.is_admin INTO v_is_admin
    FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001'; END IF;

  SELECT s.tournament_id INTO v_tournament_id
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_tournament_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.name,
           EXISTS(SELECT 1 FROM public.lobster_oscars_votes v
                   WHERE v.category_id = input_category_id AND v.voter_id = p.id) AS voted
      FROM public.players p
      JOIN public.registrations r ON r.player_id = p.id
     WHERE r.tournament_id = v_tournament_id
       AND r.status = 'registered'
     ORDER BY EXISTS(SELECT 1 FROM public.lobster_oscars_votes v
                      WHERE v.category_id = input_category_id AND v.voter_id = p.id) DESC,
              p.name ASC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_get_category_voters(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_get_category_voters(TEXT, UUID, TEXT, TEXT) TO anon;
