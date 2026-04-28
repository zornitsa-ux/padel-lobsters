-- Migration 0018 — drop the two unused v1 PII RPCs
--
-- get_my_profile and get_all_players_with_pii (v1) were superseded by
-- their _v2 counterparts months ago. Frontend uses _v2 exclusively
-- (verified by grep), and no DB function calls the v1 versions
-- (verified by pg_get_functiondef sweep across all public functions).
--
-- The other two "v1" functions you might expect to see here —
-- verify_player_pin and verify_admin_pin — are NOT dropped. They look
-- like duplicates by name but are actually the underlying bcrypt-check
-- primitives:
--   - verify_admin_pin is called by 11 functions (all admin_* RPCs
--     plus verify_admin_pin_v2 itself).
--   - verify_player_pin is called by get_my_profile_v2,
--     update_my_profile, approve_device, list_pending_devices,
--     reject_device.
-- The _v2 versions wrap these primitives with rate-limiting and audit
-- logging. Dropping the primitives would break every consumer.
--
-- Rollback: re-create the v1 functions from earlier migration history
-- (they're in the original Phase 1 / Phase 2 migrations).

drop function if exists public.get_my_profile(text);
drop function if exists public.get_all_players_with_pii(text);
