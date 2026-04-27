-- =====================================================================
-- Padel Lobsters — Fix latent bcrypt-fallback crash in verify_player_pin
-- =====================================================================
-- v1 verify_player_pin had `set search_path = 'public'` (pinned by an
-- earlier dashboard edit, before Phase 1). The function body uses bare
-- `crypt(...)` in its bcrypt-fallback query, but `crypt` lives in the
-- `extensions` schema, not `public`. As a result, ANY wrong-PIN attempt
-- that fell past the fast-plaintext path crashed with
--   "function crypt(text, text) does not exist"
-- instead of returning NULL.
--
-- The bug was masked in production because every active player also has
-- a valid `pin` column populated, so legitimate logins always matched
-- the fast path and never exercised bcrypt. Wrong PINs would have
-- thrown — the app likely caught the exception and showed a generic
-- "wrong PIN" message either way.
--
-- This migration adds `extensions` to the function's search_path. No
-- behavior change for valid PINs; wrong PINs now return NULL cleanly,
-- which is required by the Phase 2a v2 functions that delegate to v1
-- verify_player_pin (get_my_profile_v2, list_pending_devices,
-- approve_device).
-- =====================================================================

alter function public.verify_player_pin(input_pin text)
  set search_path = pg_catalog, public, extensions;
