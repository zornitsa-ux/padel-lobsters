-- =====================================================================
-- Rollback for 0009_phase2c_revoke_players_grants.sql
-- =====================================================================
-- Restores the grants that 0009 revoked. Use if Phase 2c shows a
-- production regression that can't be fixed in the app layer.
-- =====================================================================

grant select, insert, update, delete on public.players to anon, authenticated;
