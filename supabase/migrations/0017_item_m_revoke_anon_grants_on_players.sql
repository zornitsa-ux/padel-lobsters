-- Migration 0017 — Item [M]: revoke anon's direct grants on public.players
--
-- Closes the bulk-PII-via-DevTools vector. Before this migration, anyone
-- with the anon key could open browser DevTools and run
--   fetch('/rest/v1/players?select=name,email,phone,pin')
-- to dump every player's PII. After: that query returns 401, all reads
-- must go through public.players_public (redacted, no PII) or the
-- SECURITY DEFINER RPCs get_my_profile_v2 / get_all_players_with_pii_v2
-- which gate by PIN.
--
-- Frontend audit: zero callsites in src/ touch supabase.from('players')
-- directly. Phase 2c (an earlier migration) already moved every read to
-- players_public and every write to admin_*/update_my_profile RPCs. The
-- only remaining mentions are documentation comments warning future
-- devs not to bypass the RPCs.
--
-- Realtime impact: postgres_changes subscriptions on public.players
-- silently stop delivering events because realtime requires the
-- subscribing role to have SELECT on the table. The 60-second
-- setInterval loadPlayers polling in AppContext.jsx is the fallback.
-- Player-list updates take up to a minute to appear instead of being
-- instant; acceptable trade-off for the bulk-PII fix.
--
-- Rollback: re-grant anon SELECT/INSERT/UPDATE/DELETE on public.players
-- and flip security_invoker back to true.

-- 1) Switch players_public from security_invoker=true (caller-runs,
--    needs anon to have SELECT on underlying tables) to false (owner-runs,
--    bypasses anon's grants). Yesterday's rollback set this to true; we
--    flip it back so revoking grants doesn't break the view.
alter view public.players_public set (security_invoker = false);

-- 2) Revoke all anon and authenticated grants on public.players.
--    SECURITY DEFINER RPCs continue to work since they bypass these
--    grants when running as the function owner.
revoke all on public.players from anon, authenticated;
