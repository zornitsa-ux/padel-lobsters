-- RBAC Phase 4b: drop the old PIN-based function overloads
--
-- CREATE OR REPLACE only replaces an exact signature match, so the previous
-- migration left the old overloads (with input_admin_pin) alive alongside the
-- new ones. This migration drops them, leaving only the session-based signatures.

DROP FUNCTION IF EXISTS public.admin_add_player(text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.admin_approve_device(text, uuid, text);
DROP FUNCTION IF EXISTS public.admin_cancel_transfer(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.admin_delete_player(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_delete_raffle_winner(text, uuid);
DROP FUNCTION IF EXISTS public.admin_deny_device(text, uuid, text);
DROP FUNCTION IF EXISTS public.admin_force_accept_transfer(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.admin_list_pending_devices(text);
DROP FUNCTION IF EXISTS public.admin_list_security_events(text, integer);
DROP FUNCTION IF EXISTS public.admin_persist_learned_ratings(text, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.admin_record_raffle_winners(text, uuid, uuid[], text[]);
DROP FUNCTION IF EXISTS public.admin_regenerate_pin(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_unlock_player(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_update_player(text, uuid, jsonb, text, text);
DROP FUNCTION IF EXISTS public.admin_update_raffle_winner_prize(text, uuid, text);
DROP FUNCTION IF EXISTS public.get_all_players_with_pii_v2(text, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_end(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_get_category_voters(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_get_results(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_get_session(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_get_stats(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_share(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_start(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_admin_upsert_categories(text, uuid, jsonb, text, text);
