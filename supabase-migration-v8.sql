-- v8: Add preferred position (drive/revés) to player profiles
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_position text DEFAULT '';
