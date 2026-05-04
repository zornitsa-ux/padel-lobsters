-- Backfill the deleted LOBS #1-#4 tournaments + minimal registrations so
-- the new-player rule has prior-history signal for veterans whose only
-- DB trace previously was a player_aliases row.
--
-- Dates are approximate (~2 weeks apart, walked back from LOBS #5).
-- All four are inserted with status='completed' so they don't show in
-- the upcoming events list.
--
-- For registrations we backfill ONLY LOBS #4: that's enough to give every
-- known veteran a prior-registration row dated 2026-04-05, which is what
-- the new-player rule asks for. We skip seeding fake registrations for
-- the older three; their dates exist purely for cooldown math.

INSERT INTO public.tournaments (id, name, date, status, format, max_players, location, notes)
VALUES
  ('00000000-0000-0000-0000-000000010001', 'LOBStournament #1', '2026-02-22', 'completed', 'americano', 16, '', 'Backfilled placeholder'),
  ('00000000-0000-0000-0000-000000010002', 'LOBStournament #2', '2026-03-08', 'completed', 'americano', 16, '', 'Backfilled placeholder'),
  ('00000000-0000-0000-0000-000000010003', 'LOBStournament #3', '2026-03-22', 'completed', 'americano', 16, '', 'Backfilled placeholder'),
  ('00000000-0000-0000-0000-000000010004', 'LOBStournament #4', '2026-04-05', 'completed', 'americano', 16, '', 'Backfilled placeholder')
ON CONFLICT (id) DO NOTHING;

-- Register every known veteran to LOBS #4. Veteran = anyone with a
-- non-skipped player_aliases row, OR anyone who has a recorded raffle
-- win.
INSERT INTO public.registrations (tournament_id, player_id, status, payment_status)
SELECT '00000000-0000-0000-0000-000000010004'::uuid, v.player_id, 'registered', 'unpaid'
  FROM (
    SELECT player_id FROM public.player_aliases
     WHERE player_id IS NOT NULL AND skipped IS NOT TRUE
    UNION
    SELECT player_id FROM public.raffle_winners
  ) v
 WHERE NOT EXISTS (
   SELECT 1 FROM public.registrations r
    WHERE r.tournament_id = '00000000-0000-0000-0000-000000010004'::uuid
      AND r.player_id = v.player_id
 );

-- Now that LOBS #3 exists in the DB, link the existing LOBS #3 winners
-- to it and zero out their cooldown_offset (the "missing tournaments
-- between win and DB" hack is no longer needed).
UPDATE public.raffle_winners
   SET tournament_id   = '00000000-0000-0000-0000-000000010003'::uuid,
       cooldown_offset = 0
 WHERE tournament_id IS NULL
   AND tournament_label = 'LOBStournament #3';
