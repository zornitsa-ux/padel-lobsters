-- Backfill LOBS #5 and LOBS #6 raffle winners.
--
--   LOBS #5 → Nico Tzinieris (was missed in the original historical
--             seed; Paola and Ini were already seeded there).
--
--   LOBS #6 → recorded after the live raffle. Five winners total —
--             two stickers were given out:
--               Sebas solis      — tshirt
--               Nico Tzinieris   — hat
--               Trunal           — canvas bag
--               Juan Blas Diaz   — sticker
--               Mauricio Wiersma — sticker
--             Prize labels are populated by the later
--             raffle_winner_prizes migration once the column exists.
--
-- Idempotent via NOT EXISTS guards keyed on (player_id, tournament_id).

INSERT INTO public.raffle_winners
  (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset)
SELECT v.player_id::uuid, v.tournament_id::uuid, v.won_at_date::date,
       v.tournament_label, v.cooldown_offset
FROM (VALUES
  -- LOBS #5
  ('370cf0de-01f3-4c33-9a67-a5a246f01c41', '10683d63-6e7b-48c2-8e74-7087fe2a0dac', '2026-04-19', 'LOBStournament #5', 0),
  -- LOBS #6
  ('78bcf0c1-7cb8-42d5-836c-071bbe2d1c48', '45382520-87ad-489b-8e8e-8bd12aa865b7', '2026-05-03', 'LOBStournament #6', 0),
  ('370cf0de-01f3-4c33-9a67-a5a246f01c41', '45382520-87ad-489b-8e8e-8bd12aa865b7', '2026-05-03', 'LOBStournament #6', 0),
  ('5fdfc242-e0f8-4cf4-ae22-9bf593d2a0fa', '45382520-87ad-489b-8e8e-8bd12aa865b7', '2026-05-03', 'LOBStournament #6', 0),
  ('6405011a-bb4a-4747-aca9-ba32513e483f', '45382520-87ad-489b-8e8e-8bd12aa865b7', '2026-05-03', 'LOBStournament #6', 0),
  ('b3966038-b807-4ace-85f9-272d2acc5d61', '45382520-87ad-489b-8e8e-8bd12aa865b7', '2026-05-03', 'LOBStournament #6', 0)
) AS v(player_id, tournament_id, won_at_date, tournament_label, cooldown_offset)
WHERE NOT EXISTS (
  SELECT 1 FROM public.raffle_winners w
   WHERE w.player_id = v.player_id::uuid
     AND w.tournament_id = v.tournament_id::uuid
);
