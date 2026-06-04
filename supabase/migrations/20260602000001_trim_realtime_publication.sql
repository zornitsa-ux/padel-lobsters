-- ============================================================================
-- Trim the supabase_realtime publication to the single table that still drives
-- live UI updates: public.matches (schedule INSERT/DELETE liveness).
--
-- Why: the 2026-05-31 tournament nearly exhausted the project's disk-IO budget.
-- pg_stat_statements showed Supabase Realtime (WAL decode + per-subscription
-- apply_rls) dominating DB time, amplified by the app refetching whole tables
-- on every change for every connected client. The data-access refactor moves
-- registrations/settings/tournaments/transfers and the merch/aliases/league
-- surfaces to flat reads (load-on-mount + refetch-on-focus + reload-after-own-
-- write), so those tables no longer need to be published. Every write to a
-- published table is WAL-decoded and RLS-evaluated per subscription regardless
-- of whether any client reacts, so removing them removes that cost outright.
--
-- Idempotent + environment-tolerant: a fresh local DB (init migration) adds 8
-- tables to the publication; production currently has 7 (no league_teams). We
-- only drop tables that are actually members, so this applies cleanly in both.
-- ============================================================================

do $$
declare
  tbl text;
  drop_list text[] := array[
    'players',
    'tournaments',
    'registrations',
    'settings',
    'leagues',
    'league_interests',
    'league_teams',
    'league_matches'
  ];
begin
  foreach tbl in array drop_list loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', tbl);
    end if;
  end loop;
end $$;
