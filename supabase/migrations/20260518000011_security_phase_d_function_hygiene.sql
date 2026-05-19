-- Security hardening Phase D: function hygiene
--
-- 1. Drop legacy functions that are no longer called by any client code.
--    Their EXECUTE grants were already removed in Phase A; dropping them
--    eliminates the surface area entirely.
--
--    NOTE: sync_player_pin_hash() is retained. Despite the audit doc calling
--    it a "migration helper", it is an active BEFORE INSERT OR UPDATE trigger
--    on public.players that bcrypt-hashes every PIN write. Dropping it would
--    break PIN assignment across all admin RPCs and self-signup.
--
-- 2. Fix search_path on outlier functions:
--    - lobster_oscars_set_updated_at (trigger): had 'public, pg_temp'.
--      pg_temp in the path lets an attacker shadow any function with a temp
--      object for the duration of their session. Removed.
--    - 12 lobster_oscars RPCs: had 'public' only; normalize to the project
--      standard 'pg_catalog, public, extensions'.
--    - is_my_device_trusted: had 'pg_catalog, public'; add 'extensions' for
--      consistency (other RPCs have it; avoids breakage if extension fns used).
--
-- Note: the remaining RPCs already use 'pg_catalog, public, extensions' which
-- fixes the most dangerous injection vector (pg_catalog first). Setting
-- search_path='' on every function body would require rewriting all unqualified
-- table/function references — tracked as a future hardening item.

-- ── 1. Drop legacy functions ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.verify_admin_pin(text);
DROP FUNCTION IF EXISTS public.verify_admin_pin_v2(text, text, text);
DROP FUNCTION IF EXISTS public.verify_player_pin(text);

-- ── 2. Fix search_path on trigger function (remove pg_temp) ─────────────────
ALTER FUNCTION public.lobster_oscars_set_updated_at()
  SET search_path = 'pg_catalog, public, extensions';

-- ── 3. Normalize lobster_oscars RPC search paths ─────────────────────────────
ALTER FUNCTION public.lobster_oscars_admin_end(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_get_category_voters(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_get_results(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_get_session(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_get_stats(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_share(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_start(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_admin_upsert_categories(uuid, jsonb)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_cast_vote(uuid, uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_clear_vote(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_get_my_votes(uuid)
  SET search_path = 'pg_catalog, public, extensions';
ALTER FUNCTION public.lobster_oscars_get_results(uuid)
  SET search_path = 'pg_catalog, public, extensions';

-- ── 4. Normalize is_my_device_trusted (add extensions) ──────────────────────
ALTER FUNCTION public.is_my_device_trusted(uuid, text)
  SET search_path = 'pg_catalog, public, extensions';
