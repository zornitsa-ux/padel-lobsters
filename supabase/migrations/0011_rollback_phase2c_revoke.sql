-- =====================================================================
-- Roll back 0009_phase2c_revoke_players_grants.sql
-- =====================================================================
-- 0009 took the column-level GRANT approach (revoke all on players,
-- grant SELECT on a list of safe columns). That broke production within
-- minutes of being applied: PostgREST `select=*` returns 401 when
-- only column-level SELECT is held, and Supabase realtime's
-- postgres_changes delivery did not survive the column restriction
-- either. Site was down for ~24h before this rollback was applied.
--
-- This migration restores the prior state. Phase 2c will be re-attempted
-- with a different design (likely: keep table-level SELECT, instead
-- add column-level masking via a SECURITY DEFINER view that the app
-- already uses, plus revoke INSERT/UPDATE/DELETE only — accepting that
-- direct PII reads via DevTools are mitigated by application policy
-- rather than the database access layer).
-- =====================================================================

begin;

revoke select on public.players from anon, authenticated;

grant select, insert, update, delete, references, trigger, truncate
  on public.players to anon, authenticated;

alter view public.players_public set (security_invoker = true);

commit;
