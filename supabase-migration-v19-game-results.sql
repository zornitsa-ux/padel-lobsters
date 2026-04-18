-- ============================================================================
--  v19 — Persist Lobster Games results after each session ends
--
--  Up to now, when the admin clicked "Start New Game" the finished session
--  row + its votes were deleted, and with them the final standings / winners.
--  That made sense while the feature was in flux, but now we want to keep a
--  permanent snapshot of every game so we can:
--    • show a "Lobster Games Over! See Results!" banner on the tournament
--      page for the 48h the tournament stays on the home feed
--    • build a proper Results UI later (format TBD)
--
--  Design: one row per session, snapshotted when the admin hits Finish (or
--  Start New Game on a finished session). The full state goes into a `data`
--  jsonb column so we can reshape the display later without another
--  migration.
--
--  Idempotent — safe to re-run.
-- ============================================================================

create table if not exists game_results (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(id) on delete cascade,
  session_id     uuid unique not null,   -- one snapshot per game_sessions row, forever
  game_type      text not null,          -- 'trivia' | 'oscars'
  finished_at    timestamptz not null default now(),
  data           jsonb not null          -- { type, questions, votes, players, finishedAt }
);

-- Primary query pattern: "show me the latest results for tournament X"
create index if not exists game_results_by_tournament
  on game_results (tournament_id, finished_at desc);

-- Publish to realtime so a future Results UI updates live when a game ends.
do $$
begin
  begin
    alter publication supabase_realtime add table game_results;
  exception
    when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Verification (optional — run manually to confirm):
--
--   select count(*) from game_results;
--   select indexname from pg_indexes where tablename = 'game_results';
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'game_results';
-- ---------------------------------------------------------------------------
