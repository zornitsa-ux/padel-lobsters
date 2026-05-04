-- Raffle winner prize tracking.
--
-- Adds a `prize` text column to raffle_winners so admin can label what
-- each winner actually won (tshirt, hat, sticker, etc.). Backfills the
-- known LOBS #6 prize labels.
--
-- Also rolls in two RPC changes:
--   1. admin_record_raffle_winners now takes an optional input_prizes
--      TEXT[] parallel to input_player_ids, so the auto-record on draw
--      can carry a prize label through.
--   2. New admin_update_raffle_winner_prize(pin, winner_id, prize) so
--      admin can edit a prize label after the fact via the inline UI
--      on the WINNERS card.

ALTER TABLE public.raffle_winners
  ADD COLUMN IF NOT EXISTS prize TEXT;

-- ── Backfill LOBS #3 prize labels ──────────────────────────────────────
UPDATE public.raffle_winners SET prize = 'tshirt'
 WHERE tournament_label = 'LOBStournament #3'
   AND player_id        = '7f9de5e6-552f-4726-89e9-c6bf6767fa13'  -- ALEJANDRO González
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'grips'
 WHERE tournament_label = 'LOBStournament #3'
   AND player_id        = '38dc6f48-b225-4d49-9d36-d938b0432ac7'  -- Alejandro Muñoz (Alex M)
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'sticker'
 WHERE tournament_label = 'LOBStournament #3'
   AND player_id        = 'd5de9ee6-f2a4-4961-8df0-a89ca8e59b0b'  -- Gagan Shetty
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'canvas bag'
 WHERE tournament_label = 'LOBStournament #3'
   AND player_id        = '9c6dc64d-031f-4e5b-b405-56c2b49148d0'  -- Baturay Ucer
   AND prize IS NULL;

-- ── Backfill LOBS #6 prize labels ──────────────────────────────────────
UPDATE public.raffle_winners SET prize = 'tshirt'
 WHERE tournament_id = '45382520-87ad-489b-8e8e-8bd12aa865b7'::uuid
   AND player_id     = '78bcf0c1-7cb8-42d5-836c-071bbe2d1c48'  -- Sebas solis
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'hat'
 WHERE tournament_id = '45382520-87ad-489b-8e8e-8bd12aa865b7'::uuid
   AND player_id     = '370cf0de-01f3-4c33-9a67-a5a246f01c41'  -- Nico Tzinieris
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'canvas bag'
 WHERE tournament_id = '45382520-87ad-489b-8e8e-8bd12aa865b7'::uuid
   AND player_id     = '5fdfc242-e0f8-4cf4-ae22-9bf593d2a0fa'  -- Trunal
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'sticker'
 WHERE tournament_id = '45382520-87ad-489b-8e8e-8bd12aa865b7'::uuid
   AND player_id     = '6405011a-bb4a-4747-aca9-ba32513e483f'  -- Juan Blas Diaz
   AND prize IS NULL;

UPDATE public.raffle_winners SET prize = 'sticker'
 WHERE tournament_id = '45382520-87ad-489b-8e8e-8bd12aa865b7'::uuid
   AND player_id     = 'b3966038-b807-4ace-85f9-272d2acc5d61'  -- Mauricio Wiersma
   AND prize IS NULL;

-- ── RPC: admin_record_raffle_winners (now accepts optional prizes) ─────
DROP FUNCTION IF EXISTS public.admin_record_raffle_winners(TEXT, UUID, UUID[]);

CREATE OR REPLACE FUNCTION public.admin_record_raffle_winners(
  input_admin_pin     TEXT,
  input_tournament_id UUID,
  input_player_ids    UUID[],
  input_prizes        TEXT[] DEFAULT NULL
) RETURNS SETOF public.raffle_winners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_t_date  DATE;
  v_t_name  TEXT;
  v_pid     UUID;
  v_prize   TEXT;
  v_idx     INT;
  v_row     public.raffle_winners%ROWTYPE;
BEGIN
  SET LOCAL statement_timeout = '15s';
  IF NOT public.verify_admin_pin(input_admin_pin) THEN RETURN; END IF;
  IF input_tournament_id IS NULL OR input_player_ids IS NULL THEN RETURN; END IF;

  SELECT date, name INTO v_t_date, v_t_name
    FROM public.tournaments WHERE id = input_tournament_id;
  IF v_t_date IS NULL THEN RETURN; END IF;

  v_idx := 1;
  FOREACH v_pid IN ARRAY input_player_ids LOOP
    v_prize := NULL;
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
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_record_raffle_winners(TEXT, UUID, UUID[], TEXT[])
  TO anon, authenticated;

-- ── RPC: edit a winner's prize after the fact ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_raffle_winner_prize(
  input_admin_pin TEXT,
  input_winner_id UUID,
  input_prize     TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.verify_admin_pin(input_admin_pin) THEN RETURN FALSE; END IF;
  UPDATE public.raffle_winners
     SET prize = NULLIF(trim(coalesce(input_prize, '')), '')
   WHERE id = input_winner_id;
  RETURN FOUND;
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_update_raffle_winner_prize(TEXT, UUID, TEXT)
  TO anon, authenticated;
