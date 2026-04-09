-- Add padel_tips column to settings table for Tip of the Day feature
ALTER TABLE settings ADD COLUMN IF NOT EXISTS padel_tips jsonb DEFAULT NULL;
