-- Same grants in production and locally, now and for future tables (#102).
--
-- Production still carries Supabase's older default privileges: every table
-- or sequence a migration creates comes out with full access for anon and
-- authenticated, and only RLS stands behind it. The local image gives none.
-- So a migration that forgets its grants passes locally and lands wide open in
-- production. This turns those defaults off on both, and removes the extra
-- grants production already gave the tables created since then.
--
-- Supabase is making the same change on its side ("Tables no longer
-- auto-exposed to the Data API", github.com/orgs/supabase/discussions/45329):
-- new projects and the local image already have it, and existing projects
-- were due from 30 Oct 2026; this one still had the old defaults on 7 Nov.
-- Their version also revokes service_role's defaults; this one leaves
-- service_role alone, but local tests already run without them.
--
-- Only objects created by postgres (every migration) are covered; defaults
-- for objects supabase_admin creates are the platform's and need its role.

-- ── 1. New tables and sequences: no browser access unless granted ────────
-- Checked locally: with production's defaults in place, a table created after
-- these statements has no anon/authenticated privileges.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- New functions: production also grants anon and authenticated EXECUTE
-- explicitly, so a migration's `revoke execute ... from public` (the pattern
-- 20260727194010 asks for) closed a function locally but left it callable by
-- anon in production. PUBLIC's built-in EXECUTE stays on both, as that
-- migration found; the revoke from public is still needed per function.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- ── 2. Tables created under the old production defaults ──────────────────
-- End state matches what their migrations grant (and local already has).
revoke all on public.player_email_clears from authenticated;
revoke all on sequence public.player_email_clears_id_seq from authenticated;

revoke all on public.registration_status_events from authenticated;
grant select on public.registration_status_events to authenticated;
revoke all on sequence public.registration_status_events_id_seq from authenticated;

revoke all on public.raffle_exclusions from authenticated;

-- ── 3. Privileges the API never uses ─────────────────────────────────────
-- PostgREST can't issue these, and TRUNCATE skips RLS. anon lost them in
-- 20261107120000.
revoke truncate, references, trigger, maintain on all tables in schema public from authenticated;
