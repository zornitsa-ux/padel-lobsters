-- ============================================================================
-- max_players has exactly one meaning: a positive number of spots.
--
-- It was `integer default 16` and nullable (20250503000000_init.sql:68), which
-- left three states nobody had decided between. The capacity RPCs read null as
-- "uncapped" and 0 as "nobody may register"; the client read both as 16
-- (`tournament?.maxPlayers || 16`, Registration.tsx). So an event with a null
-- cap would register everyone while the UI showed "N of 16", and an event with
-- 0 would waitlist everyone while the UI showed "0 of 16" — the number on
-- screen was not the number being enforced.
--
-- Neither state is meaningful for this club: every event is a booked number of
-- courts. Constraining the column is what lets both sides drop their fallbacks
-- and agree by construction.
--
-- Backfill target is 16 because that is what the client has been displaying and
-- enforcing for these rows all along, so it changes no event's observed cap.
-- ============================================================================

update public.tournaments
   set max_players = 16
 where max_players is null
    or max_players < 1;

alter table public.tournaments
  alter column max_players set not null;

alter table public.tournaments
  drop constraint if exists tournaments_max_players_positive;
alter table public.tournaments
  add constraint tournaments_max_players_positive check (max_players > 0);

comment on column public.tournaments.max_players is
  'Registered-player cap. Always a positive integer — there is no uncapped or zero-capacity state. Enforced by registrations_enforce_capacity and the registration RPCs.';
