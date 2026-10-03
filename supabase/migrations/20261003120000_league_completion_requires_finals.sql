-- Refuse to move a league to 'completed' until its finals are decided.
--
-- Until now admin_update_league_status only enforced forward order, so a
-- season could be completed with no finals at all — which is what nearly
-- happened to Summer 2026, whose finals were never created.
--
-- Mirrors isSeasonDecided (src/features/league/domain/bracket.ts): every
-- division that has matches must have gold semis, and every bracket tier that
-- has semis must have a final with a winner.
--
-- Body is otherwise identical to 20260523000002. CREATE OR REPLACE keeps the
-- existing EXECUTE grants.

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
