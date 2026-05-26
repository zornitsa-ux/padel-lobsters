-- Fix require_trusted_device() to check player_devices directly.
--
-- Previously the trust signal was a JWT claim (app_metadata.device_trusted)
-- baked in at login time. This caused two bugs:
--
--   1. Stale after approval: approving a device updates player_devices.trusted_at
--      but never updates app_metadata, so the JWT kept saying device_trusted=false
--      until the player re-entered their PIN.
--
--   2. Per-user contamination: app_metadata is per user, not per device. A login
--      from any untrusted device overwrote device_trusted=false for ALL devices of
--      that player, causing their next token refresh to show the wrong value.
--
-- Fix: verify-pin now also stores device_id in app_metadata (alongside the
-- existing device_trusted). This function uses that device_id to do a live
-- player_devices lookup on every call, so trust reflects the current DB state.
--
-- Backward-compat: sessions predating this fix have no device_id in
-- app_metadata. Those fall back to the old device_trusted claim.

CREATE OR REPLACE FUNCTION public.require_trusted_device()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_device_id text;
BEGIN
  v_device_id := auth.jwt() -> 'app_metadata' ->> 'device_id';
  IF v_device_id IS NOT NULL THEN
    -- Live DB check: accurate after approval without requiring re-login.
    IF NOT EXISTS (
      SELECT 1 FROM public.player_devices
       WHERE player_id = auth.uid()
         AND device_id = v_device_id
         AND trusted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'pending_device_approval' USING errcode = 'P0001';
    END IF;
  ELSE
    -- Fallback for sessions predating this fix (no device_id in app_metadata).
    IF (auth.jwt() -> 'app_metadata' ->> 'device_trusted')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'pending_device_approval' USING errcode = 'P0001';
    END IF;
  END IF;
END;
$$;
