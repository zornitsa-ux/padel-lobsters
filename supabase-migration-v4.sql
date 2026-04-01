-- ================================================================
--  PADEL LOBSTERS – Migration v4
--  Adds duration field to tournaments.
--  Run in Supabase SQL Editor.
-- ================================================================

alter table tournaments
  add column if not exists duration integer default 90;
