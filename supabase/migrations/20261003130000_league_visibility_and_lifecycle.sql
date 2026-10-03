-- League visibility and season lifecycle.
--
-- 1. Visibility. A season can now be drafted while another is running without
--    players seeing it. `published_at` is null until an admin publishes; the
--    read policies hide unpublished leagues (and their teams, matches and
--    interests) from everyone but admins. Enforced here rather than by client
--    filtering because these tables are readable straight through PostgREST.
--    Existing leagues are backfilled as published so nothing disappears.
--
-- 2. Lifecycle RPCs: publish/hide, edit details, delete a draft.
--
-- 3. admin_update_league_status now advances one step at a time and checks
--    the season is ready for the next phase. Mirrors phaseReadiness in
--    src/features/league/domain/lifecycle.ts. Supersedes the body from
--    20261003120000 (the completion check is unchanged).

-- ── 1. Visibility ────────────────────────────────────────────────────────────

ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.leagues
   SET published_at = coalesce(created_at, now())
 WHERE published_at IS NULL;

DROP POLICY IF EXISTS leagues_read_all ON public.leagues;
CREATE POLICY leagues_read ON public.leagues
  FOR SELECT USING (
    published_at IS NOT NULL
    OR ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

-- The child policies defer to the leagues policy: a subquery inside a policy
-- is itself subject to RLS, so "the parent league is visible to me" is exactly
-- this EXISTS.
DROP POLICY IF EXISTS league_teams_read ON public.league_teams;
CREATE POLICY league_teams_read ON public.league_teams
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_teams.league_id)
  );

DROP POLICY IF EXISTS league_matches_read ON public.league_matches;
CREATE POLICY league_matches_read ON public.league_matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_matches.league_id)
  );

DROP POLICY IF EXISTS league_interests_read_all ON public.league_interests;
CREATE POLICY league_interests_read ON public.league_interests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_interests.league_id)
  );

-- ── 2. Lifecycle RPCs ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_league_published(
  input_league_id uuid,
  input_published boolean
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league public.leagues%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT * INTO v_league FROM public.leagues WHERE id = input_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'league not found';
  END IF;
  IF NOT input_published AND v_league.status <> 'draft' THEN
    RAISE EXCEPTION 'only a draft season can be hidden';
  END IF;
  UPDATE public.leagues
     SET published_at = CASE
           WHEN input_published THEN coalesce(published_at, now())
           ELSE NULL
         END
   WHERE id = input_league_id
   RETURNING * INTO v_league;
  RETURN v_league;
END;
$$;

-- Name is always editable. Divisions only while the season is a draft, and a
-- division that already has teams cannot be removed.
CREATE OR REPLACE FUNCTION public.admin_update_league(
  input_league_id uuid,
  input_payload   jsonb
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league    public.leagues%rowtype;
  v_name      text := btrim(coalesce(input_payload->>'name', ''));
  v_divisions text[];
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT * INTO v_league FROM public.leagues WHERE id = input_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'league not found';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'league name is required';
  END IF;

  IF jsonb_typeof(input_payload->'divisions') = 'array' THEN
    SELECT array_agg(DISTINCT lower(btrim(elem))) INTO v_divisions
      FROM jsonb_array_elements_text(input_payload->'divisions') AS elem;
    IF v_divisions IS NULL OR NOT v_divisions <@ array['mens','womens'] THEN
      RAISE EXCEPTION 'divisions must be mens and/or womens';
    END IF;
    -- Set comparison: array_agg(DISTINCT) sorts, and the stored array may be
    -- in another order or null (the UI falls back to the column default).
    IF NOT (
      v_divisions @> coalesce(v_league.divisions, array['mens','womens'])
      AND v_divisions <@ coalesce(v_league.divisions, array['mens','womens'])
    ) THEN
      IF v_league.status <> 'draft' THEN
        RAISE EXCEPTION 'divisions can only change while the season is a draft';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.league_teams
         WHERE league_id = input_league_id
           AND NOT division = ANY(v_divisions)
      ) THEN
        RAISE EXCEPTION 'cannot remove a division that has teams';
      END IF;
    END IF;
  END IF;

  UPDATE public.leagues
     SET name      = v_name,
         divisions = coalesce(v_divisions, divisions)
   WHERE id = input_league_id
   RETURNING * INTO v_league;
  RETURN v_league;
END;
$$;

-- Teams cascade with the league; matches must not exist.
CREATE OR REPLACE FUNCTION public.admin_delete_league(
  input_league_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league public.leagues%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT * INTO v_league FROM public.leagues WHERE id = input_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'league not found';
  END IF;
  IF v_league.status <> 'draft' THEN
    RAISE EXCEPTION 'only a draft season can be deleted';
  END IF;
  IF EXISTS (SELECT 1 FROM public.league_matches WHERE league_id = input_league_id) THEN
    RAISE EXCEPTION 'cannot delete a season that has matches';
  END IF;
  DELETE FROM public.leagues WHERE id = input_league_id;
  RETURN 'ok';
END;
$$;

-- ── 3. Status transitions ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_update_league_status(
  input_league_id uuid,
  input_status    text
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league      public.leagues%rowtype;
  v_new_status  text   := lower(nullif(btrim(input_status), ''));
  v_order       text[] := array['draft','group_stage','knockout','completed'];
  v_current_pos int;
  v_new_pos     int;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_league_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'status is required';
  END IF;
  SELECT * INTO v_league FROM public.leagues WHERE id = input_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_current_pos := array_position(v_order, v_league.status);
  v_new_pos     := array_position(v_order, v_new_status);
  IF v_new_pos IS NULL THEN
    RAISE EXCEPTION 'invalid status: %', v_new_status;
  END IF;
  IF v_current_pos IS NOT NULL AND v_new_pos <= v_current_pos THEN
    RAISE EXCEPTION 'status must advance forward';
  END IF;
  IF v_current_pos IS NOT NULL AND v_new_pos <> v_current_pos + 1 THEN
    RAISE EXCEPTION 'status must advance one phase at a time';
  END IF;

  IF v_new_status = 'group_stage' THEN
    IF v_league.published_at IS NULL THEN
      RAISE EXCEPTION 'publish the season before starting the group stage';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.league_teams WHERE league_id = input_league_id)
       OR EXISTS (
         SELECT 1 FROM public.league_teams t
          WHERE t.league_id = input_league_id
            AND NOT EXISTS (
              SELECT 1 FROM public.league_matches m
               WHERE m.league_id = t.league_id
                 AND m.division  = t.division
                 AND m.stage     = 'group'
            )
       ) THEN
      RAISE EXCEPTION 'every division with teams needs groups and fixtures before the group stage';
    END IF;
  END IF;

  IF v_new_status = 'knockout' AND (
    NOT EXISTS (
      SELECT 1 FROM public.league_matches
       WHERE league_id = input_league_id AND stage = 'gold_semi'
    )
    OR EXISTS (
      SELECT 1 FROM public.league_matches g
       WHERE g.league_id = input_league_id
         AND g.stage     = 'group'
         AND NOT EXISTS (
           SELECT 1 FROM public.league_matches s
            WHERE s.league_id = g.league_id
              AND s.division  = g.division
              AND s.stage     = 'gold_semi'
         )
    )
  ) THEN
    RAISE EXCEPTION 'every division needs its knockout bracket before the knockout stage';
  END IF;

  IF v_new_status = 'completed' AND (
    NOT EXISTS (
      SELECT 1 FROM public.league_matches
       WHERE league_id = input_league_id
    )
    OR EXISTS (
      SELECT 1 FROM public.league_matches m
       WHERE m.league_id = input_league_id
         AND NOT EXISTS (
           SELECT 1 FROM public.league_matches s
            WHERE s.league_id = m.league_id
              AND s.division  = m.division
              AND s.stage     = 'gold_semi'
         )
    )
    OR EXISTS (
      SELECT 1 FROM public.league_matches s
       WHERE s.league_id = input_league_id
         AND s.stage IN ('gold_semi', 'silver_semi')
         AND NOT EXISTS (
           SELECT 1 FROM public.league_matches f
            WHERE f.league_id = s.league_id
              AND f.division  = s.division
              AND f.stage     = replace(s.stage, '_semi', '_final')
              AND f.winner_id IS NOT NULL
         )
    )
  ) THEN
    RAISE EXCEPTION 'every final needs a result before the season can be completed';
  END IF;

  UPDATE public.leagues SET status = v_new_status
   WHERE id = input_league_id
   RETURNING * INTO v_league;
  RETURN v_league;
END;
$$;

-- ── 4. Grants ────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.admin_set_league_published(uuid, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_league_published(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_league(uuid, jsonb) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_update_league(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_league(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_delete_league(uuid) TO authenticated;
