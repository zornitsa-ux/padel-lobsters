-- Lock down function EXECUTE grants for real this time.
--
-- 20260518000007 ("Phase A") ran:
--     REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
-- and then granted back an allowlist. That REVOKE never took effect as
-- intended: Postgres grants EXECUTE ON FUNCTION to the pseudo-role PUBLIC by
-- default at creation time, and PUBLIC was never revoked. Every role
-- (including anon and authenticated, which are both members of PUBLIC)
-- inherits PUBLIC's grants regardless of what's revoked from them by name.
-- Net effect: every function created without an explicit REVOKE FROM PUBLIC
-- stayed anon/authenticated-executable the whole time, Phase A's allowlist
-- notwithstanding. As of this migration, 47 functions in schema public were
-- still anon-EXECUTEable through the PUBLIC grant.
--
-- This migration revokes EXECUTE from PUBLIC itself (which anon and
-- authenticated cannot route around), re-grants service_role explicitly
-- (it was riding on the same PUBLIC grant and would otherwise lose access),
-- and then re-grants the same allowlist Phase A intended — by explicit
-- argument-type signature, not bare name, so overloads can't be missed
-- silently. Protection against a future migration re-widening this is a CI
-- check rather than a database default privilege; section 2 explains why.
--
-- custom_access_token_hook is deliberately left untouched: it already runs
-- REVOKE ... FROM public, anon, authenticated and holds its own explicit
-- GRANT TO supabase_auth_admin (20260528000000). Revoking FROM PUBLIC here
-- does not touch a role-specific grant to supabase_auth_admin, so nothing
-- to redo — but we reassert it below out of caution since it is exactly the
-- kind of grant a blanket REVOKE FROM PUBLIC could be mistaken for touching.

-- ── 1. Deny-all baseline ─────────────────────────────────────────────────
-- Revoking FROM PUBLIC is the part that actually matters — anon and
-- authenticated can't route around it via PUBLIC membership. The explicit
-- anon/authenticated revokes are kept too so the statement is self-evidently
-- complete without relying on a reader to know the PUBLIC-inheritance rule.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- service_role was never granted EXECUTE explicitly anywhere in this
-- project's migrations — it has always relied on the default PUBLIC grant,
-- which the REVOKE above removes. No service_role caller invokes an RPC
-- today (verify-pin's `serviceHeaders` calls hit /rest/v1/players and the
-- /auth/v1/admin endpoints, not /rest/v1/rpc), so this is not fixing a
-- present-day breakage — it keeps the trusted server role's privileges from
-- silently narrowing, so the first Edge Function that does call an RPC works
-- instead of failing with a confusing permission error.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Reassert in case the blanket REVOKE FROM PUBLIC above is ever read as
-- touching it — it doesn't (role-specific grants are independent of the
-- PUBLIC grant), but keep this adjacent to the REVOKE so the invariant is
-- visibly maintained.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- ── 2. Why there is no ALTER DEFAULT PRIVILEGES here ───────────────────────
-- The obvious next step is a default privilege making future functions
-- deny-by-default:
--     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--       REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- That was tried and does NOT work on this stack. The pg_default_acl row is
-- stored correctly (owner postgres, schema public, objtype f, ACL without
-- PUBLIC), but functions created afterwards still come out with `=X/postgres`
-- — PUBLIC keeps its EXECUTE regardless. Verified empirically after a full
-- `db:reset`; no event trigger in the stack accounts for it.
--
-- It is also swimming against the platform: Supabase ships its own
-- pg_default_acl row for public functions granting anon/authenticated
-- EXECUTE. Functions in `public` being callable by default is the intended
-- model — they are meant to be gated by SECURITY DEFINER plus an internal
-- check (require_admin() etc, as ours are), with grants narrowed per
-- function where that matters.
--
-- So the guarantee here is deliberately a CI one, not a database one:
-- `npm run db:grants:check` diffs the live anon/authenticated EXECUTE set
-- against supabase/expected_function_grants.txt and fails on drift. A new
-- migration that adds a function will fail that check until its grants are
-- reviewed and the expected file is updated on purpose. If you add a
-- function that should not be client-callable, REVOKE it FROM PUBLIC in the
-- same migration that creates it.

-- ── 3. Re-grant the allowlist ───────────────────────────────────────────────

-- anon: pre-auth callers only.
--
-- verify_player_pin_v2 is NOT called from the browser — it looks droppable
-- from an anon grant, but it genuinely needs one. The verify-pin Edge
-- Function calls it over the REST RPC endpoint using the anon key
-- (`anonHeaders` in supabase/functions/verify-pin/index.ts), before any
-- session exists, so `anon` is the only role available to it at that point.
GRANT EXECUTE ON FUNCTION public.verify_player_pin_v2(input_pin text, input_device_id text, input_user_agent text) TO anon;

-- Genuine pre-login browser call: src/api/auth.js -> SignupRequest.jsx -> VerificationGate.jsx.
GRANT EXECUTE ON FUNCTION public.self_signup_player(input_payload jsonb, input_device_id text, input_user_agent text) TO anon;

-- authenticated: non-admin player RPCs.
GRANT EXECUTE ON FUNCTION public.approve_device(input_requesting_device_id text, input_target_device_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_device(input_requesting_device_id text, input_target_device_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_devices(input_requesting_device_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_device_session(p_device_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(input_to_player_id uuid, input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_transfer(input_transfer_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_transfer(input_transfer_id uuid, input_accept boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transfer_recipient_phone(input_transfer_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_players_with_pii_v2() TO authenticated;

-- is_my_device_trusted: SECURITY DEFINER, takes an arbitrary input_player_id
-- with no check that it belongs to the caller, so an anon grant lets anyone
-- probe device-trust state for any player. Its only real caller
-- (src/components/Layout.jsx) is post-login. The anon grant added by
-- 20260518000007 is dropped here as a deliberate security fix; authenticated
-- keeps it (already granted by 20260526000002).
GRANT EXECUTE ON FUNCTION public.is_my_device_trusted(input_player_id uuid, input_device_id text) TO authenticated;

-- authenticated: admin RPCs (still gated by require_admin() inside the function body).
GRANT EXECUTE ON FUNCTION public.admin_add_player(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_tournament_ratings(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_device(input_target_player uuid, input_target_device text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_transfer(input_transfer_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_league_groups(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_bracket_matches(input_league_id uuid, input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_league(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_league_team(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_league_team(input_team_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_player(input_target_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_raffle_winner(input_winner_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deny_device(input_target_player uuid, input_target_device text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_draw_raffle_winners(input_tournament_id uuid, input_num_winners integer, input_prizes text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_accept_transfer(input_transfer_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_mm_ratings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_raffle_exclusions(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_raffle_ineligible(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_league_player(input_player_id uuid, input_email text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_security_events(input_limit integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_persist_learned_ratings(input_updates jsonb, input_applied_tournament_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_league_match_result(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_schedule_run(input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_pin(input_target_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_rating_event(input_event_id uuid, input_action text, input_delta numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_raffle_exclusions(input_tournament_id uuid, input_player_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_player(input_target_player uuid, input_target_device text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_league_status(input_league_id uuid, input_status text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_league_team(input_team_id uuid, input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_player(input_target_id uuid, input_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_raffle_winner_prize(input_winner_id uuid, input_prize text) TO authenticated;

-- authenticated: lobster_oscars_* RPCs (excluding the lobster_oscars_set_updated_at trigger).
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_end(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_category_voters(input_category_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_results(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_session(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_stats(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_share(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_start(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_upsert_categories(input_tournament_id uuid, input_categories jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_cast_vote(input_category_id uuid, input_target_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_clear_vote(input_category_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_get_my_votes(input_tournament_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_get_results(input_tournament_id uuid) TO authenticated;

-- No grant to anon or authenticated for the rest — deliberately:
--   * Trigger functions (fire via trigger machinery, never invoked directly):
--       ensure_auth_user_for_player, sync_auth_email_to_player,
--       sync_player_email_to_auth, sync_player_pin_hash,
--       lobster_oscars_set_updated_at
--   * SQL-internal helpers (called only from inside other SECURITY DEFINER
--     functions, never as a client RPC):
--       require_admin, require_trusted_device, tournament_start_ts,
--       record_mm_reset
--   * custom_access_token_hook: handled entirely in section 1 above — grant
--     to supabase_auth_admin only, no client role.
--   * forgot_my_pin does not exist — dropped in 20260528000000. Older docs
--     that mention it are stale.
