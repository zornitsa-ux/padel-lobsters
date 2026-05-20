-- RBAC Phase 4c: drop the old PIN-based player function overloads
--
-- CREATE OR REPLACE only replaces an exact signature match, so migration 000005
-- left the old overloads (with input_pin / input_device_id / input_user_agent)
-- alive alongside the new session-based ones. This migration drops them.

DROP FUNCTION IF EXISTS public.approve_device(text, text, text);
DROP FUNCTION IF EXISTS public.reject_device(text, text, text);
DROP FUNCTION IF EXISTS public.list_pending_devices(text, text);
DROP FUNCTION IF EXISTS public.get_my_profile_v2(text, text);
DROP FUNCTION IF EXISTS public.update_my_profile(text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_transfer(text, text, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.cancel_transfer(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.respond_to_transfer(text, text, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.get_transfer_recipient_phone(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_cast_vote(text, text, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_clear_vote(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.lobster_oscars_get_my_votes(text, text, uuid, text);
