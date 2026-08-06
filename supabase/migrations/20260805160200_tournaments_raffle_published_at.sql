-- Split "draw the raffle" from "publish the winners".
--
-- The run-of-show gives the admin two distinct beats at the end of an event:
-- draw the raffle on their own screen for the room, then publish so the winners
-- appear on everyone's Results tab. Those are two persisted states and nothing
-- existing could hold the second one — `raffle_winners` has no publication
-- column, `settings` is a global singleton with no per-tournament dimension,
-- and the winner rows are world-readable (`raffle_winners_select_all`,
-- `using (true)`), so the draw itself would otherwise publish them.
--
-- Modelled directly on `results_shared_at` (D-029): a nullable timestamp that
-- gates player visibility only, independent of every other reveal. An admin can
-- publish raffle winners before, after, or interleaved with revealing standings
-- and Oscars winners.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS raffle_published_at timestamptz;

COMMENT ON COLUMN public.tournaments.raffle_published_at IS
  'When the admin published raffle winners to players. Null = drawn but not yet announced; admins always see winners regardless. Independent of results_shared_at and the Oscars session, per D-029.';

-- Backfill so nothing already-public gets newly hidden: any tournament whose
-- winners were already drawn and whose results are already revealed is treated
-- as already published. Only draws that happen after this ships start unpublished.
UPDATE public.tournaments t
  SET raffle_published_at = coalesce(t.results_shared_at, t.completed_at, now())
  WHERE t.raffle_published_at IS NULL
    AND t.results_shared_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.raffle_winners w WHERE w.tournament_id = t.id);
