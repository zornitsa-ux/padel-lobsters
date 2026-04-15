-- ============================================================================
--  v16 — Historical name → player alias map
--
--  The 4 legacy tournaments (Dec 2025, Jan 2026, Mar 2026, Apr 2026) live as
--  hardcoded data in src/components/History.jsx, where each player is stored
--  as a name string ("Zornitsa", "Alex M", "Gonzalo U") with no link to the
--  current Supabase players table.
--
--  This table is the translation dictionary: given a historical name, look
--  up the current player_id. The Players-page profile card uses it to
--  derive each player's full tournament history (count, list, podium
--  finishes, total points, win rate) on the fly — no data duplication.
--
--  Idempotent — safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_aliases (
  historical_name TEXT      PRIMARY KEY,
  player_id       UUID      NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_aliases_player_id_idx
  ON player_aliases (player_id);

-- Open RLS (admin-only writes are gated client-side via the admin PIN).
-- Reads are needed by every player to render their own profile.
ALTER TABLE player_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_aliases readable by all" ON player_aliases;
CREATE POLICY "player_aliases readable by all"
  ON player_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "player_aliases writable by all" ON player_aliases;
CREATE POLICY "player_aliases writable by all"
  ON player_aliases FOR ALL
  USING (true) WITH CHECK (true);

-- Verification
SELECT 'player_aliases table ready' AS status,
       COUNT(*) AS rows
FROM   player_aliases;
