-- Rollback for 0009_phase2c_revoke_players_grants.sql
-- Restores anon/authenticated's direct grants on public.players and
-- reverts the players_public view to security_invoker.

begin;

revoke select on public.players from anon, authenticated;

grant select, insert, update, delete, references, trigger, truncate
  on public.players to anon, authenticated;

alter view public.players_public set (security_invoker = true);

commit;
