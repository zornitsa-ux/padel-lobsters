-- Remove the PII-dump quota from get_all_players_with_pii_v2.
--
-- The RPC capped admins at 3 successful full-roster reads per rolling 24h
-- (c_max_dumps_24h). The cap constrained normal admin work without a threat
-- model that justified it, and its failure mode was wrong: on exhaustion it
-- inserted a succeeded = false row and did a bare RETURN, so the caller got an
-- EMPTY SET rather than an error and Players.jsx silently rendered an empty
-- roster with no explanation.
--
-- Deliberately preserved:
--   * the require_admin() gate — this is still admin-only,
--   * the succeeded = true audit insert — AdminSecurityPanels.jsx's 'pii'
--     filter reads those pin_attempts rows, so dropping it would break the
--     admin security panel,
--   * SECURITY DEFINER, search_path, and the statement_timeout.
--
-- The older device-keyed overload (init.sql:967) was already dropped by
-- 20260512000004; only this no-arg version exists. CREATE OR REPLACE keeps the
-- GRANT EXECUTE TO authenticated made in 20260518000007.

CREATE OR REPLACE FUNCTION public.get_all_players_with_pii_v2()
RETURNS SETOF players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (auth.uid(), 'pii_dump', true);
  RETURN QUERY SELECT * FROM public.players ORDER BY name;
END $$;
