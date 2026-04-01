-- ================================================================
--  PADEL LOBSTERS – Migration v2
--  Run this in the Supabase SQL Editor to add new columns.
--  Safe to run even if columns already exist.
-- ================================================================

alter table tournaments
  add column if not exists location          text    default '',
  add column if not exists court_booking_mode text   default 'admin_all',
  add column if not exists total_price        numeric default 0;
