-- Raffle rebuild: move fairness/eligibility enforcement server-side.
--
-- Previously the eligible pool, cooldown and winner selection were all
-- computed in the browser and the RPC blindly inserted whatever ids it was
-- handed. This migration makes the server the single source of truth:
--   * admin_draw_raffle_winners — picks AND records fair winners in one
--     atomic transaction. There is no preview/re-roll: a draw is final, so
--     nothing on a shared screen looks like results are being re-spun.
--   * admin_set/get_raffle_exclusions — per-tournament admin override to drop
--     specific registered players from THIS draw only.
-- Cooldown length is an admin setting (settings.raffle_cooldown_tournaments).

-- ---------------------------------------------------------------------------
-- Cooldown setting (number of tournaments a winner sits out before re-eligible)
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS raffle_cooldown_tournaments int NOT NULL DEFAULT 2;

-- ---------------------------------------------------------------------------
-- Per-tournament eligibility exclusions.
-- Presence of a row = admin has removed this player from THIS tournament's
-- draw. Tournament-scoped by design: an excluded player is simply never
-- drawn here, so no raffle_winners row is written and their cooldown / future
-- odds are completely untouched.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.raffle_exclusions (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id     uuid NOT NULL REFERENCES public.players(id)     ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, player_id)
);

ALTER TABLE public.raffle_exclusions ENABLE ROW LEVEL SECURITY;

-- Direct writes are RPC-only (house rule); reads happen via admin_get RPC.
REVOKE INSERT, UPDATE, DELETE ON public.raffle_exclusions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_draw_raffle_winners — atomic fair draw + record.
-- Eligible pool = registered − already-won-here − cooldown − admin-excluded.
-- Picks `input_num_winners` at random, inserts them, returns the new rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winners(
  input_tournament_id uuid,
  input_num_winners   int,
  input_prizes        text[] DEFAULT NULL
)
RETURNS SETOF public.raffle_winners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_t_date   date;
  v_t_name   text;
  v_cooldown int;
  v_picked   uuid[];
  v_pid      uuid;
  v_prize    text;
  v_idx      int;
  v_row      public.raffle_winners%rowtype;
  v_n        int;
BEGIN
  SET LOCAL statement_timeout = '15s';
  PERFORM public.require_admin();
  IF input_tournament_id IS NULL THEN RETURN; END IF;

  SELECT date, name INTO v_t_date, v_t_name
    FROM public.tournaments WHERE id = input_tournament_id;
  IF v_t_date IS NULL THEN RETURN; END IF;

  SELECT coalesce(raffle_cooldown_tournaments, 2) INTO v_cooldown
    FROM public.settings WHERE id = 1;
  v_cooldown := coalesce(v_cooldown, 2);
  v_n := greatest(coalesce(input_num_winners, 1), 0);
  IF v_n = 0 THEN RETURN; END IF;

  -- Compute the eligible pool and pick the winners in one shot.
  SELECT array_agg(player_id) INTO v_picked
    FROM (
      SELECT r.player_id
        FROM (
          SELECT DISTINCT r.player_id
            FROM public.registrations r
           WHERE r.tournament_id = input_tournament_id
             AND r.status = 'registered'
             -- admin removed them from this tournament's draw
             AND NOT EXISTS (
               SELECT 1 FROM public.raffle_exclusions x
                WHERE x.tournament_id = input_tournament_id
                  AND x.player_id = r.player_id
             )
             -- already won this tournament's raffle
             AND NOT EXISTS (
               SELECT 1 FROM public.raffle_winners w
                WHERE w.player_id = r.player_id
                  AND w.tournament_id = input_tournament_id
             )
             -- cooldown: a prior win with fewer than v_cooldown tournaments since
             AND NOT EXISTS (
               SELECT 1 FROM public.raffle_winners w
                WHERE w.player_id = r.player_id
                  AND w.won_at_date < v_t_date
                  AND (
                    SELECT count(*) FROM public.tournaments t
                     WHERE t.date > w.won_at_date AND t.date < v_t_date
                  ) + coalesce(w.cooldown_offset, 0) < v_cooldown
             )
        ) r
       ORDER BY random()
       LIMIT v_n
    ) picked;

  IF v_picked IS NULL THEN RETURN; END IF;

  v_idx := 1;
  FOREACH v_pid IN ARRAY v_picked LOOP
    v_prize := NULL;
    IF input_prizes IS NOT NULL AND v_idx <= array_length(input_prizes, 1) THEN
      v_prize := input_prizes[v_idx];
    END IF;
    v_idx := v_idx + 1;

    INSERT INTO public.raffle_winners
      (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
    VALUES
      (v_pid, input_tournament_id, v_t_date, v_t_name, 0, v_prize)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- admin_set_raffle_exclusions — replace this tournament's exclusion set.
-- Idempotent: wipes existing rows for the tournament, inserts the new set.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_raffle_exclusions(
  input_tournament_id uuid,
  input_player_ids    uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  SET LOCAL statement_timeout = '15s';
  PERFORM public.require_admin();
  IF input_tournament_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.raffle_exclusions WHERE tournament_id = input_tournament_id;

  IF input_player_ids IS NOT NULL AND array_length(input_player_ids, 1) > 0 THEN
    INSERT INTO public.raffle_exclusions (tournament_id, player_id)
    SELECT input_tournament_id, x
      FROM unnest(input_player_ids) AS x
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- admin_get_raffle_exclusions — excluded player ids for a tournament.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_raffle_exclusions(
  input_tournament_id uuid
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  SET LOCAL statement_timeout = '15s';
  PERFORM public.require_admin();
  IF input_tournament_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT player_id FROM public.raffle_exclusions
     WHERE tournament_id = input_tournament_id;
END $$;

-- ---------------------------------------------------------------------------
-- admin_get_raffle_ineligible — registered players the DRAW would skip on its
-- own, regardless of admin choices: those still on cooldown from a recent win,
-- or who already won this tournament. Powers the eligibility screen's status
-- badges. Reason ∈ { 'cooldown', 'won_here' }. Admin exclusions are separate
-- and intentionally NOT included here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_raffle_ineligible(
  input_tournament_id uuid
)
RETURNS TABLE(player_id uuid, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_t_date   date;
  v_cooldown int;
BEGIN
  SET LOCAL statement_timeout = '15s';
  PERFORM public.require_admin();
  IF input_tournament_id IS NULL THEN RETURN; END IF;

  SELECT date INTO v_t_date FROM public.tournaments WHERE id = input_tournament_id;
  IF v_t_date IS NULL THEN RETURN; END IF;

  SELECT coalesce(raffle_cooldown_tournaments, 2) INTO v_cooldown
    FROM public.settings WHERE id = 1;
  v_cooldown := coalesce(v_cooldown, 2);

  RETURN QUERY
    SELECT DISTINCT r.player_id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.raffle_winners w
           WHERE w.player_id = r.player_id
             AND w.tournament_id = input_tournament_id
        ) THEN 'won_here'
        ELSE 'cooldown'
      END AS reason
      FROM public.registrations r
     WHERE r.tournament_id = input_tournament_id
       AND r.status = 'registered'
       AND (
         EXISTS (
           SELECT 1 FROM public.raffle_winners w
            WHERE w.player_id = r.player_id
              AND w.tournament_id = input_tournament_id
         )
         OR EXISTS (
           SELECT 1 FROM public.raffle_winners w
            WHERE w.player_id = r.player_id
              AND w.won_at_date < v_t_date
              AND (
                SELECT count(*) FROM public.tournaments t
                 WHERE t.date > w.won_at_date AND t.date < v_t_date
              ) + coalesce(w.cooldown_offset, 0) < v_cooldown
         )
       );
END $$;

-- ---------------------------------------------------------------------------
-- Grants — authenticated admins only; the require_admin() guard is the real
-- boundary, the grant is defense-in-depth.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_draw_raffle_winners(uuid, int, text[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_raffle_exclusions(uuid, uuid[])    FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_raffle_exclusions(uuid)            FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_raffle_ineligible(uuid)            FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_draw_raffle_winners(uuid, int, text[]) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_set_raffle_exclusions(uuid, uuid[])    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_raffle_exclusions(uuid)            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_raffle_ineligible(uuid)            TO authenticated;

-- Superseded functions.
DROP FUNCTION IF EXISTS public.admin_record_raffle_winners(uuid, uuid[], text[]);
DROP FUNCTION IF EXISTS public.admin_preview_raffle_draw(uuid, int);
DROP FUNCTION IF EXISTS public.admin_commit_raffle_winners(uuid, uuid[], text[]);
