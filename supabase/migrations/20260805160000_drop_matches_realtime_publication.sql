-- ============================================================================
-- Empty the supabase_realtime publication: drop the last remaining table,
-- public.matches, and with it the app's use of postgres_changes entirely.
--
-- Why: 20260602000001 trimmed the publication from 8 tables to 1 after the
-- 2026-05-31 tournament nearly exhausted the disk-IO budget. It wasn't enough.
-- Measured on prod 2026-07-29 (pg_stat_statements, all-time):
--
--   Realtime machinery (apply_rls / WAL poll / subscription churn)  49,444 s   79%
--   All PostgREST app queries combined                               3,587 s    6%
--
-- The cost is not per-write, it's a standing tax: Realtime polls the
-- replication slot continuously for as long as ANY table is published. Sampled
-- with zero live subscriptions and no users on the app, the WAL-poll query was
-- still running ~1.9 calls/sec at ~6 ms each — roughly 1% of a core, 24/7.
-- During a tournament it multiplies, because apply_rls runs per WAL record per
-- subscription and the client-side event filter is applied only after that
-- per-subscriber RLS pass — so every score UPDATE was decoded and RLS-checked
-- for every connected phone, even though no client subscribed to UPDATEs.
--
-- Schedule liveness (matches INSERT/DELETE on regeneration) moves to a
-- 'schedule' event on the existing per-tournament Broadcast channel, which is
-- WebSocket fan-out and never touches Postgres.
--
-- Idempotent: only drops the table if it is actually a member.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime drop table public.matches;
  end if;
end $$;
