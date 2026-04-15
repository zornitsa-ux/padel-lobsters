-- ============================================================================
--  v16b — Fix: allow "Not in roster" entries in player_aliases
--
--  v16 made player_id NOT NULL, so the matcher's "Not in roster" button
--  (used for guests who never joined the Lobsters group) failed with:
--    invalid input syntax for type uuid: "__not_in_roster__"
--
--  Fix: drop the NOT NULL on player_id and add a skipped boolean.
--    • A real match     → player_id = <uuid>, skipped = false
--    • "Not in roster"  → player_id = NULL,   skipped = true
--
--  Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE player_aliases
  ALTER COLUMN player_id DROP NOT NULL;

ALTER TABLE player_aliases
  ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT FALSE;

-- Sanity: a row should EITHER point to a player OR be skipped, never both.
ALTER TABLE player_aliases
  DROP CONSTRAINT IF EXISTS player_aliases_xor_check;
ALTER TABLE player_aliases
  ADD CONSTRAINT player_aliases_xor_check
  CHECK ((player_id IS NOT NULL) <> skipped);

-- Verification
SELECT historical_name, player_id, skipped
FROM   player_aliases
ORDER  BY historical_name;
