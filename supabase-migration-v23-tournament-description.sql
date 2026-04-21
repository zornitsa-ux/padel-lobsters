-- ============================================================================
--  v23 — Tournament description (renamed from Notes)
--
--  The admin "Notes" field on each tournament is now shown publicly on the
--  home screen and the event detail page as a Description. To keep things
--  consistent we prefill every new event with a default template (check-in
--  timing, what's included, pairings). The existing underlying column
--  (`tournaments.notes`) is reused — we only rename the label in the UI,
--  no schema change is needed.
--
--  This migration backfills the description for Lobstournament #6 so the
--  public-facing event page matches the new defaults. Adjust the WHERE
--  clause if the event is renamed in the future.
--
--  Idempotent — safe to re-run (it just re-sets the same text).
-- ============================================================================

update tournaments
set    notes = $$Please arrive 15 minutes early for a quick check-in, meet & greet, and rules briefing.
Includes courts, balls 🎾, food 🍗, a winner's prize, and raffle prizes 🏆
Pairings are arranged for fun, balanced games.$$
where  name ilike 'Lobstournament #6%'
   or  name ilike 'Lobstournament 6%'
   or  name ilike 'Lobsters%#6%';
