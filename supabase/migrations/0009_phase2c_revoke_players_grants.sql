-- =====================================================================
-- Phase 2c — final lockdown: revoke direct grants on public.players
-- =====================================================================
-- Closes the bulk-PII vector for good. After this runs, an attacker
-- holding the anon key cannot do `select email, phone, birthday from
-- players` from DevTools. PII can only be reached via the SECURITY
-- DEFINER RPCs (get_my_profile_v2, get_all_players_with_pii_v2) which
-- gate on PIN + device trust + rate limits + audit logging.
--
-- Three changes:
--   1. Switch players_public back to security_definer. The view's role
--      has shifted from "documentation-only redaction" (Phase 1) to
--      "canonical controlled-access boundary" — so it must run as its
--      creator to bypass the underlying-table grants we restrict next.
--      Supabase advisor will re-flag this as security_definer_view —
--      that's the deliberate design choice for Phase 2c.
--   2. Revoke all grants on public.players from anon, authenticated.
--   3. Grant SELECT on non-PII columns only — required for Supabase
--      realtime postgres_changes events to deliver. Notably absent:
--      email, phone, birthday, notes, pin, pin_hash, locked_until.
-- =====================================================================

begin;

alter view public.players_public set (security_invoker = false);

revoke all on public.players from anon, authenticated;

grant select (
  id, name, status, gender, is_left_handed, preferred_position, country,
  tagline, tagline_label, playtomic_level, playtomic_username,
  playtomic_updated_at, adjustment, adjusted_level, avatar_url,
  created_at, pin_changes
) on public.players to anon, authenticated;

commit;
