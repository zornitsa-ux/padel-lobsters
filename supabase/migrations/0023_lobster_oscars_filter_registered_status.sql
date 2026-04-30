-- Lobster Oscars: only consider players with status='registered' as
-- eligible voters, eligible targets, and counted participants.
-- Cancelled / waitlisted registrations no longer affect the totals or
-- the cast_vote checks.

CREATE OR REPLACE FUNCTION public.lobster_oscars_cast_vote(
  input_pin TEXT, input_device_id TEXT, input_category_id UUID, input_target_id UUID, input_user_agent TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voter_id UUID; v_pin_status TEXT; v_session_id UUID; v_tournament_id UUID;
  v_started_at TIMESTAMPTZ; v_closed_at TIMESTAMPTZ;
  v_voter_registered BOOLEAN; v_target_registered BOOLEAN; v_existed BOOLEAN;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
    FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;
  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN RETURN 'invalid_pin'; END IF;
  IF v_voter_id = input_target_id THEN RETURN 'self_vote'; END IF;
  SELECT c.session_id, s.tournament_id, s.started_at, s.closed_at
    INTO v_session_id, v_tournament_id, v_started_at, v_closed_at
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_session_id IS NULL THEN RETURN 'invalid_category'; END IF;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.registrations r
    WHERE r.tournament_id = v_tournament_id AND r.player_id = v_voter_id AND r.status = 'registered'
  ) INTO v_voter_registered;
  IF NOT v_voter_registered THEN RETURN 'voter_not_registered'; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.registrations r
    WHERE r.tournament_id = v_tournament_id AND r.player_id = input_target_id AND r.status = 'registered'
  ) INTO v_target_registered;
  IF NOT v_target_registered THEN RETURN 'invalid_target'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.lobster_oscars_votes WHERE category_id = input_category_id AND voter_id = v_voter_id)
    INTO v_existed;
  INSERT INTO public.lobster_oscars_votes (category_id, voter_id, target_id)
    VALUES (input_category_id, v_voter_id, input_target_id)
    ON CONFLICT (category_id, voter_id) DO UPDATE SET target_id = EXCLUDED.target_id, updated_at = now();
  RETURN CASE WHEN v_existed THEN 'updated' ELSE 'voted' END;
END; $$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_stats(
  input_admin_pin TEXT, input_tournament_id UUID, input_device_id TEXT DEFAULT NULL, input_user_agent TEXT DEFAULT NULL
) RETURNS TABLE(category_id UUID, category_name TEXT, category_icon TEXT, display_order INTEGER, votes_count BIGINT, total_participants BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_admin BOOLEAN; v_session_id UUID; v_total_participants BIGINT;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001'; END IF;
  SELECT s.id INTO v_session_id FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_total_participants
    FROM public.registrations r
   WHERE r.tournament_id = input_tournament_id
     AND r.status = 'registered';
  RETURN QUERY
    SELECT c.id, c.name, c.icon, c.display_order, COALESCE(vc.cnt, 0::BIGINT), v_total_participants
      FROM public.lobster_oscars_categories c
      LEFT JOIN (SELECT v.category_id, count(*) AS cnt FROM public.lobster_oscars_votes v GROUP BY v.category_id) vc
        ON vc.category_id = c.id
     WHERE c.session_id = v_session_id
     ORDER BY c.display_order;
END; $$;
