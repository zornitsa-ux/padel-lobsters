-- ================================================================
--  PADEL LOBSTERS – Migration v3
--  Run this in the Supabase SQL Editor.
--  Safe to run even if columns already exist.
-- ================================================================

alter table players
  add column if not exists gender text default '',
  add column if not exists status text default 'active';
