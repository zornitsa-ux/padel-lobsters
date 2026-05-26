-- Fix function EXECUTE grants for RPCs called from authenticated client contexts.
--
-- 1. is_my_device_trusted: 403 "permission denied for function".
--    Layout.jsx calls it only when a session exists, so the caller is the
--    `authenticated` role. Phase A (20260518000007) revoked EXECUTE from both
--    anon and authenticated, then re-granted only to anon — so logged-in users
--    were denied. Grant it to authenticated as well.
--
-- 2. League RPCs (20260523000002): created AFTER Phase A's
--    `REVOKE EXECUTE ON ALL FUNCTIONS` ran, so they were never covered by it and
--    still carry Postgres's default PUBLIC EXECUTE grant. That means anon can
--    invoke them too (they fail require_admin() internally, so no escalation —
--    but it diverges from the Phase A default-deny posture). Lock them down:
--    revoke from public/anon, grant to authenticated only.

GRANT EXECUTE ON FUNCTION public.is_my_device_trusted(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_create_league(jsonb)                       FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_league_status(uuid, text)           FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_league_team(jsonb)                  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_league_team(uuid, jsonb)            FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_league_team(uuid)                   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_league_groups(jsonb)               FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_record_league_match_result(jsonb)          FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_bracket_matches(uuid, jsonb)        FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_invite_league_player(uuid, text)           FROM public, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_league(jsonb)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_league_status(uuid, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_league_team(jsonb)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_league_team(uuid, jsonb)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_league_team(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_league_groups(jsonb)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_league_match_result(jsonb)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_bracket_matches(uuid, jsonb)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_league_player(uuid, text)            TO authenticated;
