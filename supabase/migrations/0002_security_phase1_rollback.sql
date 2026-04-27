-- =====================================================================
-- Padel Lobsters — Security hardening, Phase 1 — ROLLBACK
-- =====================================================================
-- Reverts every change made by 0002_security_phase1.sql back to the
-- pre-migration state captured 2026-04-27 from pg_policies / pg_proc /
-- pg_class. Run this if Phase 1 causes a user-visible regression.
--
-- Safe to run as-is on a clean prod (uses IF EXISTS / IF NOT EXISTS
-- guards everywhere a name might already be present).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Reverse step 5 (deduplicated league/alias policies)
-- Restore the original two-policy split: "<table> read" (SELECT) +
-- "<table> write" (ALL), both on role public, both USING(true).
-- ---------------------------------------------------------------------

-- player_aliases
drop policy if exists "player_aliases anon read"   on public.player_aliases;
drop policy if exists "player_aliases anon insert" on public.player_aliases;
drop policy if exists "player_aliases anon update" on public.player_aliases;
drop policy if exists "player_aliases anon delete" on public.player_aliases;
create policy "player_aliases readable by all" on public.player_aliases for select to public using (true);
create policy "player_aliases writable by all" on public.player_aliases for all    to public using (true) with check (true);

-- league_interests
drop policy if exists "league_interests anon read"   on public.league_interests;
drop policy if exists "league_interests anon insert" on public.league_interests;
drop policy if exists "league_interests anon update" on public.league_interests;
drop policy if exists "league_interests anon delete" on public.league_interests;
create policy "league_interests read"  on public.league_interests for select to public using (true);
create policy "league_interests write" on public.league_interests for all    to public using (true) with check (true);

-- league_teams
drop policy if exists "league_teams anon read"   on public.league_teams;
drop policy if exists "league_teams anon insert" on public.league_teams;
drop policy if exists "league_teams anon update" on public.league_teams;
drop policy if exists "league_teams anon delete" on public.league_teams;
create policy "league_teams read"  on public.league_teams for select to public using (true);
create policy "league_teams write" on public.league_teams for all    to public using (true) with check (true);

-- leagues
drop policy if exists "leagues anon read"   on public.leagues;
drop policy if exists "leagues anon insert" on public.leagues;
drop policy if exists "leagues anon update" on public.leagues;
drop policy if exists "leagues anon delete" on public.leagues;
create policy "leagues read"  on public.leagues for select to public using (true);
create policy "leagues write" on public.leagues for all    to public using (true) with check (true);

-- ---------------------------------------------------------------------
-- Reverse step 4 (players_public view security_invoker)
-- ---------------------------------------------------------------------

alter view public.players_public set (security_invoker = false);

-- ---------------------------------------------------------------------
-- Reverse step 3 (storage SELECT policies on avatars / merch)
-- ---------------------------------------------------------------------

create policy "Public read from avatars" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "Public read from merch"   on storage.objects for select to anon, authenticated using (bucket_id = 'merch');

-- ---------------------------------------------------------------------
-- Reverse step 2 (function search_path pin)
-- Restore mutable search_path on the five functions.
-- ---------------------------------------------------------------------

alter function public.sync_player_pin_hash()                     reset search_path;
alter function public.sync_admin_pin_hash()                      reset search_path;
alter function public.verify_admin_pin(input_pin text)           reset search_path;
alter function public.get_my_profile(input_pin text)             reset search_path;
alter function public.get_all_players_with_pii(admin_pin text)   reset search_path;

-- ---------------------------------------------------------------------
-- Reverse step 1 (RLS on five public tables)
-- Drop policies first, then disable RLS — reverse of the apply order.
-- ---------------------------------------------------------------------

drop policy if exists "game_results anon read"    on public.game_results;
drop policy if exists "game_results anon insert"  on public.game_results;
drop policy if exists "game_results anon update"  on public.game_results;
drop policy if exists "game_results anon delete"  on public.game_results;
alter table public.game_results disable row level security;

drop policy if exists "game_votes anon read"    on public.game_votes;
drop policy if exists "game_votes anon insert"  on public.game_votes;
drop policy if exists "game_votes anon update"  on public.game_votes;
drop policy if exists "game_votes anon delete"  on public.game_votes;
alter table public.game_votes disable row level security;

drop policy if exists "game_sessions anon read"    on public.game_sessions;
drop policy if exists "game_sessions anon insert"  on public.game_sessions;
drop policy if exists "game_sessions anon update"  on public.game_sessions;
drop policy if exists "game_sessions anon delete"  on public.game_sessions;
alter table public.game_sessions disable row level security;

drop policy if exists "merch_interests anon read"    on public.merch_interests;
drop policy if exists "merch_interests anon insert"  on public.merch_interests;
drop policy if exists "merch_interests anon update"  on public.merch_interests;
drop policy if exists "merch_interests anon delete"  on public.merch_interests;
alter table public.merch_interests disable row level security;

drop policy if exists "merch_items anon read"    on public.merch_items;
drop policy if exists "merch_items anon insert"  on public.merch_items;
drop policy if exists "merch_items anon update"  on public.merch_items;
drop policy if exists "merch_items anon delete"  on public.merch_items;
alter table public.merch_items disable row level security;

commit;
