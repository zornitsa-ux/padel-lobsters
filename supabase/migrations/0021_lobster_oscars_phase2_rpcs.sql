-- Lobster Oscars — phase 2: RPCs
-- All SECURITY DEFINER, search_path locked to public.
-- Player RPCs gated via verify_player_pin_v2; admin RPCs via verify_admin_pin_v2.
-- get_results is share-gated (no PIN, returns empty until shared_at IS NOT NULL).

-- ============================================================================
-- PLAYER RPCs
-- ============================================================================

-- 1. Get my votes for a tournament
CREATE OR REPLACE FUNCTION public.lobster_oscars_get_my_votes(
  input_pin         TEXT,
  input_device_id   TEXT,
  input_tournament_id UUID,
  input_user_agent  TEXT DEFAULT NULL
)
RETURNS TABLE(category_id UUID, target_id UUID, target_name TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_voter_id   UUID;
  v_pin_status TEXT;
  v_session_id UUID;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
  FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;

  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_pin' USING errcode = 'P0001';
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_get_my_votes(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_get_my_votes(TEXT, TEXT, UUID, TEXT) TO anon;

-- 2. Cast vote (upsert; idempotent for same target)
CREATE OR REPLACE FUNCTION public.lobster_oscars_cast_vote(
  input_pin         TEXT,
  input_device_id   TEXT,
  input_category_id UUID,
  input_target_id   UUID,
  input_user_agent  TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_voter_id          UUID;
  v_pin_status        TEXT;
  v_session_id        UUID;
  v_tournament_id     UUID;
  v_started_at        TIMESTAMPTZ;
  v_closed_at         TIMESTAMPTZ;
  v_voter_registered  BOOLEAN;
  v_target_registered BOOLEAN;
  v_existed           BOOLEAN;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
  FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;

  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN
    RETURN 'invalid_pin';
  END IF;

  IF v_voter_id = input_target_id THEN
    RETURN 'self_vote';
  END IF;

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
    WHERE r.tournament_id = v_tournament_id AND r.player_id = v_voter_id
  ) INTO v_voter_registered;
  IF NOT v_voter_registered THEN RETURN 'voter_not_registered'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.tournament_id = v_tournament_id AND r.player_id = input_target_id
  ) INTO v_target_registered;
  IF NOT v_target_registered THEN RETURN 'invalid_target'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.lobster_oscars_votes
    WHERE category_id = input_category_id AND voter_id = v_voter_id
  ) INTO v_existed;

  INSERT INTO public.lobster_oscars_votes (category_id, voter_id, target_id)
  VALUES (input_category_id, v_voter_id, input_target_id)
  ON CONFLICT (category_id, voter_id) DO UPDATE
    SET target_id = EXCLUDED.target_id,
        updated_at = now();

  RETURN CASE WHEN v_existed THEN 'updated' ELSE 'voted' END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_cast_vote(TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_cast_vote(TEXT, TEXT, UUID, UUID, TEXT) TO anon;

-- 3. Get results — share-gated, no PIN required
CREATE OR REPLACE FUNCTION public.lobster_oscars_get_results(
  input_tournament_id UUID
)
RETURNS TABLE(
  category_id      UUID,
  category_name    TEXT,
  category_icon    TEXT,
  display_order    INTEGER,
  target_id        UUID,
  target_name      TEXT,
  votes_count      BIGINT,
  rank_in_category BIGINT,
  total_voters     BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session_id   UUID;
  v_shared_at    TIMESTAMPTZ;
  v_total_voters BIGINT;
BEGIN
  SELECT s.id, s.shared_at INTO v_session_id, v_shared_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;

  IF v_session_id IS NULL OR v_shared_at IS NULL THEN RETURN; END IF;

  SELECT count(DISTINCT v.voter_id) INTO v_total_voters
  FROM public.lobster_oscars_votes v
  JOIN public.lobster_oscars_categories c ON c.id = v.category_id
  WHERE c.session_id = v_session_id;

  RETURN QUERY
  WITH counts AS (
    SELECT
      c.id           AS category_id,
      c.name         AS category_name,
      c.icon         AS category_icon,
      c.display_order,
      v.target_id,
      p.name         AS target_name,
      count(*)::BIGINT AS votes_count
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_votes v ON v.category_id = c.id
    JOIN public.players p ON p.id = v.target_id
    WHERE c.session_id = v_session_id
    GROUP BY c.id, c.name, c.icon, c.display_order, v.target_id, p.name
  )
  SELECT
    counts.category_id, counts.category_name, counts.category_icon, counts.display_order,
    counts.target_id, counts.target_name, counts.votes_count,
    rank() OVER (PARTITION BY counts.category_id ORDER BY counts.votes_count DESC),
    v_total_voters
  FROM counts
  ORDER BY counts.display_order, rank() OVER (PARTITION BY counts.category_id ORDER BY counts.votes_count DESC), counts.target_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_get_results(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_get_results(UUID) TO anon;

-- ============================================================================
-- ADMIN RPCs
-- ============================================================================

-- 4. Get session state
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_session(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TABLE(
  session_id   UUID,
  tournament_id UUID,
  started_at   TIMESTAMPTZ,
  closed_at    TIMESTAMPTZ,
  shared_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT s.id, s.tournament_id, s.started_at, s.closed_at, s.shared_at, s.created_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_get_session(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_get_session(TEXT, UUID, TEXT, TEXT) TO anon;

-- 5. Upsert categories (creates session if missing; only allowed before start)
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_upsert_categories(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_categories   JSONB,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin   BOOLEAN;
  v_session_id UUID;
  v_started_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;

  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;

  IF input_categories IS NULL OR jsonb_typeof(input_categories) <> 'array' OR jsonb_array_length(input_categories) < 1 THEN
    RETURN 'empty_categories';
  END IF;

  SELECT s.id, s.started_at INTO v_session_id, v_started_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;

  IF v_session_id IS NULL THEN
    INSERT INTO public.lobster_oscars_sessions (tournament_id)
    VALUES (input_tournament_id) RETURNING id INTO v_session_id;
  ELSIF v_started_at IS NOT NULL THEN
    RETURN 'already_started';
  END IF;

  DELETE FROM public.lobster_oscars_categories WHERE session_id = v_session_id;

  INSERT INTO public.lobster_oscars_categories (session_id, name, icon, display_order)
  SELECT v_session_id,
         COALESCE(NULLIF(btrim(elem->>'name'), ''), 'Untitled'),
         COALESCE(NULLIF(btrim(elem->>'icon'), ''), '🦞'),
         COALESCE((elem->>'display_order')::INTEGER, (ord - 1)::INTEGER)
  FROM jsonb_array_elements(input_categories) WITH ORDINALITY AS arr(elem, ord);

  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_upsert_categories(TEXT, UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_upsert_categories(TEXT, UUID, JSONB, TEXT, TEXT) TO anon;

-- 6. Start
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_start(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin   BOOLEAN;
  v_session_id UUID;
  v_started_at TIMESTAMPTZ;
  v_cat_count  INTEGER;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;

  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;

  SELECT s.id, s.started_at INTO v_session_id, v_started_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;

  IF v_session_id IS NULL THEN RETURN 'no_session'; END IF;
  IF v_started_at IS NOT NULL THEN RETURN 'already_started'; END IF;

  SELECT count(*) INTO v_cat_count FROM public.lobster_oscars_categories WHERE session_id = v_session_id;
  IF v_cat_count = 0 THEN RETURN 'no_categories'; END IF;

  UPDATE public.lobster_oscars_sessions SET started_at = now() WHERE id = v_session_id;
  RETURN 'started';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_start(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_start(TEXT, UUID, TEXT, TEXT) TO anon;

-- 7. End
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_end(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin   BOOLEAN;
  v_started_at TIMESTAMPTZ;
  v_closed_at  TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;

  SELECT s.started_at, s.closed_at INTO v_started_at, v_closed_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;

  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'already_ended'; END IF;

  UPDATE public.lobster_oscars_sessions SET closed_at = now() WHERE tournament_id = input_tournament_id;
  RETURN 'ended';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_end(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_end(TEXT, UUID, TEXT, TEXT) TO anon;

-- 8. Share
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_share(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin  BOOLEAN;
  v_closed_at TIMESTAMPTZ;
  v_shared_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;

  SELECT s.closed_at, s.shared_at INTO v_closed_at, v_shared_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;

  IF v_closed_at IS NULL THEN RETURN 'not_ended'; END IF;
  IF v_shared_at IS NOT NULL THEN RETURN 'already_shared'; END IF;

  UPDATE public.lobster_oscars_sessions SET shared_at = now() WHERE tournament_id = input_tournament_id;
  RETURN 'shared';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_share(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_share(TEXT, UUID, TEXT, TEXT) TO anon;

-- 9. Stats per category (for active phase)
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_stats(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TABLE(
  category_id        UUID,
  category_name      TEXT,
  category_icon      TEXT,
  display_order      INTEGER,
  votes_count        BIGINT,
  total_participants BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin           BOOLEAN;
  v_session_id         UUID;
  v_total_participants BIGINT;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001';
  END IF;

  SELECT s.id INTO v_session_id
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_total_participants
  FROM public.registrations r
  WHERE r.tournament_id = input_tournament_id;

  RETURN QUERY
  SELECT
    c.id, c.name, c.icon, c.display_order,
    COALESCE(vc.cnt, 0::BIGINT),
    v_total_participants
  FROM public.lobster_oscars_categories c
  LEFT JOIN (
    SELECT v.category_id, count(*) AS cnt
    FROM public.lobster_oscars_votes v
    GROUP BY v.category_id
  ) vc ON vc.category_id = c.id
  WHERE c.session_id = v_session_id
  ORDER BY c.display_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_get_stats(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_get_stats(TEXT, UUID, TEXT, TEXT) TO anon;

-- 10. Admin results (post-end, regardless of share)
CREATE OR REPLACE FUNCTION public.lobster_oscars_admin_get_results(
  input_admin_pin    TEXT,
  input_tournament_id UUID,
  input_device_id    TEXT DEFAULT NULL,
  input_user_agent   TEXT DEFAULT NULL
)
RETURNS TABLE(
  category_id      UUID,
  category_name    TEXT,
  category_icon    TEXT,
  display_order    INTEGER,
  target_id        UUID,
  target_name      TEXT,
  votes_count      BIGINT,
  rank_in_category BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin   BOOLEAN;
  v_session_id UUID;
  v_started_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin
  FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001';
  END IF;

  SELECT s.id, s.started_at INTO v_session_id, v_started_at
  FROM public.lobster_oscars_sessions s
  WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL OR v_started_at IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH counts AS (
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      c.icon AS category_icon,
      c.display_order,
      v.target_id,
      p.name AS target_name,
      count(*)::BIGINT AS votes_count
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_votes v ON v.category_id = c.id
    JOIN public.players p ON p.id = v.target_id
    WHERE c.session_id = v_session_id
    GROUP BY c.id, c.name, c.icon, c.display_order, v.target_id, p.name
  )
  SELECT
    counts.category_id, counts.category_name, counts.category_icon, counts.display_order,
    counts.target_id, counts.target_name, counts.votes_count,
    rank() OVER (PARTITION BY counts.category_id ORDER BY counts.votes_count DESC)
  FROM counts
  ORDER BY counts.display_order,
           rank() OVER (PARTITION BY counts.category_id ORDER BY counts.votes_count DESC),
           counts.target_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lobster_oscars_admin_get_results(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobster_oscars_admin_get_results(TEXT, UUID, TEXT, TEXT) TO anon;
