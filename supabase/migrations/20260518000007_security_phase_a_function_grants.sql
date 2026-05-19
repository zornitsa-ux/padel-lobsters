-- Security hardening Phase A: lock down function execute grants and harden require_admin
-- Implements Phase A from SECURITY-AUDIT.md (2026-05-18)

-- Revoke blanket EXECUTE for client roles
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Pre-auth / anon-callable functions
GRANT EXECUTE ON FUNCTION public.verify_player_pin_v2(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.self_signup_player(jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.forgot_my_pin(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_my_device_trusted(uuid, text) TO anon;

-- Authenticated player RPCs
GRANT EXECUTE ON FUNCTION public.get_my_profile_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_devices(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_transfer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transfer_recipient_phone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_cast_vote(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_clear_vote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_get_my_votes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_get_results(uuid) TO authenticated;

-- Authenticated admin RPCs (still gated by require_admin())
GRANT EXECUTE ON FUNCTION public.admin_add_player(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_player(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_player(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_player(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_device(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deny_device(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_security_events(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_accept_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_persist_learned_ratings(jsonb, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_raffle_winners(uuid, uuid[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_raffle_winner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_raffle_winner_prize(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_players_with_pii_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_start(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_end(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_upsert_categories(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lobster_oscars_admin_get_category_voters(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_start_ts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_admin() TO authenticated;

-- Harden search_path on the authorization helper to prevent search-path injection
ALTER FUNCTION public.require_admin() SET search_path = '';
