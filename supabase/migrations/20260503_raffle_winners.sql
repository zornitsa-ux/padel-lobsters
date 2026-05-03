-- ─────────────────────────────────────────────────────────────────────────────
-- Raffle winners — track who has won the prize raffle, enforce a 3-tournament
-- cooldown (including the win itself), and require new players to have at
-- least 1 prior tournament before becoming raffle-eligible.
--
-- Eligibility (computed in frontend):
--   For tournament X (date = X.date), player P is INELIGIBLE if any of:
--     a) P has zero registrations with status='registered' for tournaments
--        whose date < X.date (new-player rule).
--     b) Exists a raffle_winners row W where:
--          (count(tournaments WHERE date > W.won_at_date AND date < X.date)
--           + W.cooldown_offset) < 2
--        i.e. fewer than 2 OTHER tournaments have happened between the win
--        and X. Combined with the win tournament itself, that's < 3 total
--        cooldown tournaments.
--
-- cooldown_offset exists for historical seed rows whose "won at" tournament
-- isn't in the tournaments table. For example a LOBS #3 winner with
-- cooldown_offset=1 means "the missing #4 between #3 and the current DB
-- counts as 1". This keeps the eligibility math correct without backfilling
-- past tournament records.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.raffle_winners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  tournament_id     UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  won_at_date       DATE NOT NULL,
  tournament_label  TEXT,
  cooldown_offset   INT  NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raffle_winners_player_id
  ON public.raffle_winners(player_id);
CREATE INDEX IF NOT EXISTS idx_raffle_winners_won_at_date
  ON public.raffle_winners(won_at_date DESC);

ALTER TABLE public.raffle_winners ENABLE ROW LEVEL SECURITY;

-- Reads are open: frontend computes eligibility client-side, and the names
-- on the WINNERS card are already public when projected. Writes go through
-- SECURITY DEFINER RPCs (no INSERT/UPDATE/DELETE policies → blocked).
DROP POLICY IF EXISTS raffle_winners_select_all ON public.raffle_winners;
CREATE POLICY raffle_winners_select_all ON public.raffle_winners
  FOR SELECT TO anon, authenticated USING (true);

-- ── RPC: record raffle winners after a confirmed draw ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_record_raffle_winners(
  input_admin_pin     TEXT,
  input_tournament_id UUID,
  input_player_ids    UUID[]
) RETURNS SETOF public.raffle_winners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_t_date  DATE;
  v_t_name  TEXT;
  v_pid     UUID;
  v_row     public.raffle_winners%ROWTYPE;
BEGIN
  SET LOCAL statement_timeout = '15s';
  IF NOT public.verify_admin_pin(input_admin_pin) THEN RETURN; END IF;
  IF input_tournament_id IS NULL OR input_player_ids IS NULL THEN RETURN; END IF;

  SELECT date, name INTO v_t_date, v_t_name
    FROM public.tournaments WHERE id = input_tournament_id;
  IF v_t_date IS NULL THEN RETURN; END IF;

  FOREACH v_pid IN ARRAY input_player_ids LOOP
    -- Skip duplicates (same player, same tournament) silently.
    IF EXISTS (
      SELECT 1 FROM public.raffle_winners
       WHERE player_id = v_pid AND tournament_id = input_tournament_id
    ) THEN CONTINUE; END IF;

    INSERT INTO public.raffle_winners
      (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset)
    VALUES
      (v_pid, input_tournament_id, v_t_date, v_t_name, 0)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END $function$;

-- ── RPC: delete a raffle winner row (mistakes, re-draws) ────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_raffle_winner(
  input_admin_pin TEXT,
  input_winner_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.verify_admin_pin(input_admin_pin) THEN RETURN FALSE; END IF;
  DELETE FROM public.raffle_winners WHERE id = input_winner_id;
  RETURN TRUE;
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_record_raffle_winners(TEXT, UUID, UUID[])
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_raffle_winner(TEXT, UUID)
  TO anon, authenticated;
