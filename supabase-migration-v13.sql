-- v13: Fix player_id type — players table uses UUID but merch_interests had integer
-- Drop the foreign key constraint first, then change column to text (works with any ID type)
ALTER TABLE merch_interests DROP CONSTRAINT IF EXISTS merch_interests_player_id_fkey;
ALTER TABLE merch_interests ALTER COLUMN player_id TYPE text USING player_id::text;

-- Drop the unique constraint and recreate it (needed because column type changed)
ALTER TABLE merch_interests DROP CONSTRAINT IF EXISTS merch_interests_player_id_merch_item_id_key;
ALTER TABLE merch_interests ADD CONSTRAINT merch_interests_player_id_merch_item_id_key UNIQUE (player_id, merch_item_id);

-- Delete any old broken orders with invalid player_ids
DELETE FROM merch_interests WHERE player_id IS NULL OR player_id = 'NaN' OR player_id = '';
