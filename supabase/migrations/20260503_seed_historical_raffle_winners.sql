-- Seed historical raffle winners.
--
--   LOBS #3 winners → ALEJANDRO González, Alejandro Muñoz (alias "Alex M"),
--                     Gagan Shetty, Baturay Ucer.
--                     LOBS #3 itself isn't in the tournaments table, so we
--                     use an approximate won_at_date of 2026-03-22 and set
--                     cooldown_offset=1 to compensate for the missing LOBS #4
--                     in between.
--
--   LOBS #5 winners → Paola Hasbún Lopez, Ini.
--                     LOBS #5 IS in the DB (2026-04-19) so we link
--                     tournament_id and use the exact date with offset=0.
--
--   Kathy (LOBS #4) → not in players table; skipped per user instruction.
--
-- Idempotent via NOT EXISTS guards keyed on (player_id, won_at_date).

INSERT INTO public.raffle_winners
  (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset)
SELECT v.player_id::uuid, v.tournament_id::uuid, v.won_at_date::date,
       v.tournament_label, v.cooldown_offset
FROM (VALUES
  ('7f9de5e6-552f-4726-89e9-c6bf6767fa13', NULL,                                   '2026-03-22', 'LOBStournament #3', 1),
  ('38dc6f48-b225-4d49-9d36-d938b0432ac7', NULL,                                   '2026-03-22', 'LOBStournament #3', 1),
  ('d5de9ee6-f2a4-4961-8df0-a89ca8e59b0b', NULL,                                   '2026-03-22', 'LOBStournament #3', 1),
  ('9c6dc64d-031f-4e5b-b405-56c2b49148d0', NULL,                                   '2026-03-22', 'LOBStournament #3', 1),
  ('3a526d40-f7ef-479e-888e-355edf8fdb4a', '10683d63-6e7b-48c2-8e74-7087fe2a0dac', '2026-04-19', 'LOBStournament #5', 0),
  ('532677e6-c438-4959-91c7-0e3a24be6827', '10683d63-6e7b-48c2-8e74-7087fe2a0dac', '2026-04-19', 'LOBStournament #5', 0)
) AS v(player_id, tournament_id, won_at_date, tournament_label, cooldown_offset)
WHERE NOT EXISTS (
  SELECT 1 FROM public.raffle_winners w
   WHERE w.player_id = v.player_id::uuid
     AND w.won_at_date = v.won_at_date::date
);
