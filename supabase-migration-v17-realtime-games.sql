-- ============================================================================
--  v17 — Enable realtime on Lobster Games tables
--
--  Bug: when an admin clicks "Start Game!" in a Lobster Games session
--  (trivia / Oscars), the admin sees the new state immediately because
--  Game.jsx calls loadSession() locally right after patching. Players,
--  however, remained stuck on "Waiting for admin to start…" until they
--  refreshed the page.
--
--  Root cause: Game.jsx subscribes to postgres_changes on game_sessions
--  and game_votes, but these two tables were never added to the
--  supabase_realtime publication (only the original tables from
--  supabase-setup.sql — players, tournaments, registrations, matches,
--  settings — were). So Supabase never pushed change events for the
--  game tables, and the player clients never got notified.
--
--  Fix: add both tables to the realtime publication. No code changes
--  needed — the subscription logic in src/components/Game.jsx already
--  reloads on any change event.
--
--  Idempotent — safe to re-run. Uses a DO block so each ALTER is wrapped
--  in its own exception handler, because Postgres raises 42710
--  (duplicate_object) if the table is already part of the publication.
-- ============================================================================

do $$
begin
  begin
    alter publication supabase_realtime add table game_sessions;
  exception
    when duplicate_object then null;  -- already added, skip
  end;

  begin
    alter publication supabase_realtime add table game_votes;
  exception
    when duplicate_object then null;  -- already added, skip
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Verification (optional — run manually to confirm):
--
--   select schemaname, tablename
--   from   pg_publication_tables
--   where  pubname = 'supabase_realtime'
--     and  tablename in ('game_sessions', 'game_votes');
--
-- Expected: both rows returned.
-- ---------------------------------------------------------------------------
