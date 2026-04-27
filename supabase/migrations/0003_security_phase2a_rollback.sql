-- =====================================================================
-- Padel Lobsters — Security hardening, Phase 2a — ROLLBACK
-- =====================================================================
-- Reverses every change made by 0003_security_phase2a.sql.
-- Safe to run on a clean prod (uses IF EXISTS guards).
--
-- Note: this drops the audit log (pin_attempts) and the device registry
-- (player_devices). If those have accumulated data you want to keep,
-- back them up before running this.
-- =====================================================================

begin;

-- Drop functions (in reverse dependency order)
drop function if exists public.admin_unlock_player(text, uuid, text, text);
drop function if exists public.approve_device(text, text, text);
drop function if exists public.list_pending_devices(text, text);
drop function if exists public.is_my_device_trusted(uuid, text);
drop function if exists public.get_all_players_with_pii_v2(text, text, text);
drop function if exists public.get_my_profile_v2(text, text);
drop function if exists public.verify_admin_pin_v2(text, text, text);
drop function if exists public.verify_player_pin_v2(text, text, text);

-- Drop tables (player_devices first since pin_attempts has no FK back to it)
drop table if exists public.pin_attempts;
drop table if exists public.player_devices;

-- Remove the locked_until column
alter table public.players drop column if exists locked_until;

commit;
