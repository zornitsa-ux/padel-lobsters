-- ================================================================
--  PADEL LOBSTERS – Test Player Profiles (Regular Players)
--  Players who appeared across Dec 2025, Jan 2026, Mar 2026 tournaments.
--  NOTE: Zornitsa is skipped — she already exists in the database.
--  Run this in Supabase SQL Editor to seed test accounts.
-- ================================================================

insert into players (name, gender, playtomic_level, adjustment, adjusted_level, playtomic_username, email, status, notes)
values
  ('Marielle',  'female', 2.0, 0.0, 2.0, 'marielle',  'marielle@lobsters.test',  'active', 'Regular · Jan: 28pts · Mar: 17pts'),
  ('Gonzalo U', 'male',   2.5, 0.0, 2.5, 'gonzalo_u', 'gonzalou@lobsters.test',  'active', 'Regular · Jan: 26pts · Mar: 19pts'),
  ('Alex M',    'male',   3.5, 0.0, 3.5, 'alexm',     'alexm@lobsters.test',     'active', 'Regular · Jan: 21pts · Mar: 27pts'),
  ('Sebas',     'male',   3.5, 0.0, 3.5, 'sebas',     'sebas@lobsters.test',     'active', 'Regular · Jan: 22pts · Mar: 24pts'),
  ('Jon',       'male',   3.5, 0.0, 3.5, 'jon',       'jon@lobsters.test',       'active', 'Regular · Jan: 18pts · Mar: 22pts'),
  ('Juan',      'male',   3.5, 0.0, 3.5, 'juan',      'juan@lobsters.test',      'active', 'Regular · Jan: 17pts · Mar: 24pts'),
  ('Chris',     'male',   3.0, 0.0, 3.0, 'chris',     'chris@lobsters.test',     'active', 'Regular · Jan: 22pts · Mar: 22pts'),
  ('Mauri',     'male',   3.0, 0.0, 3.0, 'mauri',     'mauri',                   'active', 'Regular · Jan: 20pts · Mar: 22pts'),
  ('Markus',    'male',   3.0, 0.0, 3.0, 'markus',    'markus@lobsters.test',    'active', 'Regular · Jan: 22pts · Mar: 17pts'),
  ('Nico',      'male',   3.0, 0.0, 3.0, 'nico',      'nico@lobsters.test',      'active', 'Regular · Jan: 22pts · Mar: 19pts'),
  ('Alex G',    'male',   3.0, 0.0, 3.0, 'alexg',     'alexg@lobsters.test',     'active', 'Regular · Jan: 18pts · Mar: 18pts'),
  ('Gonzalo E', 'male',   3.0, 0.0, 3.0, 'gonzalo_e', 'gonzaloe@lobsters.test',  'active', 'Regular · Jan: 23pts'),
  ('Gagan',     'male',   2.5, 0.0, 2.5, 'gagan',     'gagan@lobsters.test',     'active', 'Regular · Jan: 19pts · Mar: 15pts'),
  ('Paola',     'female', 2.0, 0.0, 2.0, 'paola',     'paola@lobsters.test',     'active', 'Regular · Jan: 16pts · Mar: 14pts'),
  ('Rowan',     'male',   2.0, 0.0, 2.0, 'rowan',     'rowan@lobsters.test',     'active', 'Regular · Mar: 19pts')

on conflict do nothing;
