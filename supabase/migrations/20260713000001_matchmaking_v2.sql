-- Matchmaking V2 — consolidated Phase 3 schema, RPCs and hooks.
--
-- Squashed from five unpushed migrations (nothing in this set ever reached
-- production; prod's last applied migration is 20260701000000):
--   20260713000001_matchmaking_v2_schema        → §1-§8
--   20260714000001_mm_admin_only_profile        → §9
--   20260714000002_mm_self_reset_hook           → §10
--   20260714000004_grant_settings_write         → §11
--
-- The rollout-flag migration (20260714000003) is dropped from this squash —
-- unread since D-028 removed the client flag. Nothing else in this set was
-- ever applied to prod, so it costs nothing to omit.
--
-- Ordering is load-bearing: §9 redacts columns added in §1, and §10 inserts
-- into the table created in §2.
--
-- §11 and §12 are NOT Matchmaking V2 changes — §11 repairs a pre-existing
-- production privilege bug, §12 adds the results-reveal gate (D-029). Both are
-- folded in here only because they ship in the same push and this migration
-- hasn't reached prod yet; each section's rationale is preserved verbatim.
--
-- §13 finishes the D-020 format cutover on the DB side.

-- ── 1. players learned-rating columns ────────────────────────────────────────
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS mm_rating            numeric,
  ADD COLUMN IF NOT EXISTS mm_sigma             numeric,
  ADD COLUMN IF NOT EXISTS mm_rating_updated_at timestamptz;

-- ── 2. rating_events: audit trail (tournament updates + self-resets) ─────────
CREATE TABLE IF NOT EXISTS public.rating_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL DEFAULT 'tournament',   -- 'tournament' | 'self_reset' | 'admin_edit'
  tournament_id  uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,  -- null for self_reset/admin_edit
  player_id      uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  prior_mu       numeric NOT NULL,
  prior_sigma    numeric NOT NULL,
  proposed_delta numeric NOT NULL,   -- raw model output
  applied_delta  numeric NOT NULL,   -- what actually moved mm_rating (post-cap, post-review)
  flagged        boolean NOT NULL DEFAULT false,
  review_status  text,               -- null | 'approved' | 'edited' | 'discarded'
  reviewed_by    uuid,               -- auth.uid() of the acting admin
  reviewed_at    timestamptz,
  breakdown      jsonb NOT NULL,     -- per-match decomposition (§4.4)
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rating_events_tournament_id_idx ON public.rating_events (tournament_id);
CREATE INDEX IF NOT EXISTS rating_events_player_id_idx     ON public.rating_events (player_id);
CREATE INDEX IF NOT EXISTS rating_events_review_queue_idx  ON public.rating_events (created_at)
  WHERE flagged AND review_status IS NULL;

-- ── 3. schedule_runs: one row per committed generation (D-016) ───────────────
CREATE TABLE IF NOT EXISTS public.schedule_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  config        jsonb NOT NULL,
  seed          bigint NOT NULL,
  report        jsonb NOT NULL,      -- ScheduleRun (§3.4)
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_runs_tournament_id_idx ON public.schedule_runs (tournament_id, created_at DESC);

-- ── 4. RLS: admin-only read; writes are RPC-only (no write policy) ───────────
-- Enabling RLS with only a SELECT policy denies direct INSERT/UPDATE/DELETE to
-- everyone but the table owner; the SECURITY DEFINER RPCs below are the sole
-- write path (D-016). SECURITY DEFINER functions run as owner and bypass RLS.
ALTER TABLE public.rating_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rating_events_admin_read ON public.rating_events;
CREATE POLICY rating_events_admin_read ON public.rating_events
  FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS schedule_runs_admin_read ON public.schedule_runs;
CREATE POLICY schedule_runs_admin_read ON public.schedule_runs
  FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- These tables are created after security_phase_c's blanket REVOKE, so they
-- carry Supabase's default full grant to anon/authenticated. Reassert the house
-- default-deny posture: anon gets nothing; authenticated keeps only SELECT
-- (RLS above narrows it to admins); writes stay RPC-only (owner-run SECURITY
-- DEFINER functions are unaffected by these revokes).
REVOKE ALL ON public.rating_events FROM anon, authenticated;
REVOKE ALL ON public.schedule_runs FROM anon, authenticated;
GRANT SELECT ON public.rating_events TO authenticated;
GRANT SELECT ON public.schedule_runs TO authenticated;

-- ── 5. admin_apply_tournament_ratings ────────────────────────────────────────
-- Persists a completed tournament's rating update transactionally: one
-- rating_events row + one players.mm_* update per player. The domain
-- (rating/update.ts + guardrails.ts) computes new_mu/new_sigma and the already-
-- capped applied_delta; this RPC only persists and gates. Refuses to double-
-- apply a tournament that already has 'tournament'-kind events.
--
-- Payload: { tournament_id, updates: [ { player_id, prior_mu, prior_sigma,
--   new_mu, new_sigma, proposed_delta, applied_delta, flagged, breakdown } ] }
CREATE OR REPLACE FUNCTION public.admin_apply_tournament_ratings(input_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_tid   uuid;
  v_elem  jsonb;
  v_count integer := 0;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();

  IF input_payload IS NULL THEN
    RAISE EXCEPTION 'payload required';
  END IF;

  v_tid := (input_payload->>'tournament_id')::uuid;
  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'tournament_id required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.rating_events re
    WHERE re.tournament_id = v_tid AND re.kind = 'tournament'
  ) THEN
    RAISE EXCEPTION 'ratings already applied for tournament %', v_tid;
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(coalesce(input_payload->'updates', '[]'::jsonb))
  LOOP
    INSERT INTO public.rating_events (
      kind, tournament_id, player_id, prior_mu, prior_sigma,
      proposed_delta, applied_delta, flagged, review_status, breakdown
    ) VALUES (
      'tournament',
      v_tid,
      (v_elem->>'player_id')::uuid,
      (v_elem->>'prior_mu')::numeric,
      (v_elem->>'prior_sigma')::numeric,
      (v_elem->>'proposed_delta')::numeric,
      (v_elem->>'applied_delta')::numeric,
      coalesce((v_elem->>'flagged')::boolean, false),
      NULL,
      coalesce(v_elem->'breakdown', '[]'::jsonb)
    );

    UPDATE public.players
      SET mm_rating            = (v_elem->>'new_mu')::numeric,
          mm_sigma             = (v_elem->>'new_sigma')::numeric,
          mm_rating_updated_at = now()
      WHERE id = (v_elem->>'player_id')::uuid;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 6. admin_review_rating_event ─────────────────────────────────────────────
-- Resolves a flagged event exactly once. 'approve' applies the withheld
-- remainder (proposed_delta − applied_delta); 'edit' applies input_delta on top
-- of what was already applied; 'discard' applies nothing. In all cases
-- applied_delta is updated to the true total that hit mm_rating.
CREATE OR REPLACE FUNCTION public.admin_review_rating_event(
  input_event_id uuid,
  input_action   text,
  input_delta    numeric DEFAULT NULL
)
RETURNS public.rating_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_evt   public.rating_events%rowtype;
  v_extra numeric := 0;
BEGIN
  PERFORM public.require_admin();

  SELECT * INTO v_evt FROM public.rating_events WHERE id = input_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rating event % not found', input_event_id;
  END IF;
  IF v_evt.review_status IS NOT NULL THEN
    RAISE EXCEPTION 'rating event % already reviewed (%)', input_event_id, v_evt.review_status;
  END IF;
  IF NOT v_evt.flagged THEN
    RAISE EXCEPTION 'rating event % is not flagged for review', input_event_id;
  END IF;

  IF input_action = 'approve' THEN
    v_extra := v_evt.proposed_delta - v_evt.applied_delta;
  ELSIF input_action = 'edit' THEN
    IF input_delta IS NULL THEN
      RAISE EXCEPTION 'edit action requires input_delta';
    END IF;
    v_extra := input_delta;
  ELSIF input_action = 'discard' THEN
    v_extra := 0;
  ELSE
    RAISE EXCEPTION 'invalid action: % (expected approve | edit | discard)', input_action;
  END IF;

  IF v_extra <> 0 THEN
    UPDATE public.players
      SET mm_rating            = coalesce(mm_rating, 0) + v_extra,
          mm_rating_updated_at = now()
      WHERE id = v_evt.player_id;
  END IF;

  UPDATE public.rating_events
    SET review_status = CASE input_action
                          WHEN 'approve' THEN 'approved'
                          WHEN 'edit'    THEN 'edited'
                          ELSE 'discarded'
                        END,
        applied_delta = v_evt.applied_delta + v_extra,
        reviewed_by   = auth.uid(),
        reviewed_at   = now()
    WHERE id = input_event_id
    RETURNING * INTO v_evt;

  RETURN v_evt;
END;
$$;

-- ── 7. admin_record_schedule_run ─────────────────────────────────────────────
-- Logs one committed generation run. Payload: { tournament_id, config, seed, report }.
CREATE OR REPLACE FUNCTION public.admin_record_schedule_run(input_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.require_admin();

  IF input_payload IS NULL THEN
    RAISE EXCEPTION 'payload required';
  END IF;

  INSERT INTO public.schedule_runs (tournament_id, config, seed, report)
  VALUES (
    (input_payload->>'tournament_id')::uuid,
    coalesce(input_payload->'config', '{}'::jsonb),
    (input_payload->>'seed')::bigint,
    coalesce(input_payload->'report', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 8. admin_get_mm_ratings ──────────────────────────────────────────────────
-- The learned prior, for seeding the matcher and the next tournament's rating
-- update. mm_* is admin-only (DESIGN §5) and therefore absent from
-- players_public, so the client roster cannot carry it; without this the engine
-- silently re-seeds every event from playtomic_level and never compounds what
-- it learned.
--
-- Deliberately NOT served by get_all_players_with_pii_v2: that RPC exists to
-- dump PII and carries a 3-per-day audited quota, which schedule generation
-- would exhaust immediately. This returns two numbers and no PII.
CREATE OR REPLACE FUNCTION public.admin_get_mm_ratings()
RETURNS TABLE (player_id uuid, mm_rating numeric, mm_sigma numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();

  RETURN QUERY
    SELECT p.id, p.mm_rating, p.mm_sigma
      FROM public.players p
     WHERE p.mm_rating IS NOT NULL;
END;
$$;

-- Grants (functions gate internally via require_admin). New functions inherit
-- Supabase's default EXECUTE grant to anon/PUBLIC; reassert security_phase_a's
-- posture — only signed-in users reach the require_admin gate.
REVOKE EXECUTE ON FUNCTION public.admin_apply_tournament_ratings(jsonb)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_review_rating_event(uuid, text, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_record_schedule_run(jsonb)               FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_get_mm_ratings()                         FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_apply_tournament_ratings(jsonb)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_rating_event(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_schedule_run(jsonb)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_mm_ratings()                         TO authenticated;

-- ── 9. mm_* is admin-only: redacted from the self-profile (D-017) ────────────
-- get_my_profile_v2() returns SETOF players via SELECT *, which after §1
-- transmits a signed-in player their own mm_rating / mm_sigma /
-- mm_rating_updated_at. DESIGN §5 wants admin-only visibility for the learned
-- rating. Null those three columns in the returned row while keeping the
-- RETURNS SETOF players signature (row shape unchanged; no client type change).
-- The rowtype-variable redaction is robust to future players columns.
--
-- Admin visibility is preserved elsewhere: get_all_players_with_pii_v2()
-- (require_admin-gated) still returns the real values, §8 serves the matcher,
-- and players_public omits mm_* via its explicit column list.
CREATE OR REPLACE FUNCTION public.get_my_profile_v2()
RETURNS SETOF public.players
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_player_id uuid;
  v_row       public.players%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  FOR v_row IN SELECT * FROM public.players WHERE id = v_player_id LOOP
    v_row.mm_rating            := NULL;
    v_row.mm_sigma             := NULL;
    v_row.mm_rating_updated_at := NULL;
    RETURN NEXT v_row;
  END LOOP;
END
$function$;

-- ── 10. Self-edit reset hook (M3.3; D-002, D-008, D-018) ─────────────────────
-- A playtomic_level edit re-anchors the learned prior: mm_rating := new level,
-- mm_sigma := 0.7 (SIGMA_PRIOR), logged as a rating_events row. update_my_profile
-- logs kind='self_reset'; admin_update_player logs kind='admin_edit' (D-008: an
-- admin level edit triggers the same reset semantics).
--
-- Both RPCs stop writing `adjustment` and drop the `+ adjustment` term, but keep
-- adjusted_level mirroring playtomic_level so legacy display stays faithful until
-- M4.3 drops the column and migrates its ~13 read sites (D-018). The self-
-- adjustment mechanism is otherwise gone (D-002): adjustment is no longer read.

-- Shared reset + audit helper (internal to the two RPCs below). Sets mm_* to the
-- re-anchored prior and inserts the audit row in one place. applied_delta is the
-- true movement of mm_rating (new level − prior mu). Execute is revoked from all
-- client roles; the SECURITY DEFINER callers run as owner and reach it, direct
-- client calls cannot (no mm_* tampering path).
CREATE OR REPLACE FUNCTION public.record_mm_reset(
  input_player_id   uuid,
  input_new_level   numeric,
  input_prior_mu    numeric,
  input_prior_sigma numeric,
  input_kind        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  UPDATE public.players
    SET mm_rating            = input_new_level,
        mm_sigma             = 0.7,
        mm_rating_updated_at = now()
    WHERE id = input_player_id;

  INSERT INTO public.rating_events (
    kind, tournament_id, player_id, prior_mu, prior_sigma,
    proposed_delta, applied_delta, flagged, review_status, breakdown
  ) VALUES (
    input_kind, NULL, input_player_id, input_prior_mu, input_prior_sigma,
    0, input_new_level - input_prior_mu, false, NULL, '[]'::jsonb
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.record_mm_reset(uuid, numeric, numeric, numeric, text)
  FROM anon, authenticated, public;

-- update_my_profile: self-edit resets the prior; no adjustment write.
CREATE OR REPLACE FUNCTION public.update_my_profile(input_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_player_id     uuid;
  v_old_level     numeric;
  v_old_mm        numeric;
  v_old_sigma     numeric;
  v_new_level     numeric;
  v_level_changed boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL OR input_payload IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  PERFORM public.require_trusted_device();

  SELECT playtomic_level, mm_rating, mm_sigma
    INTO v_old_level, v_old_mm, v_old_sigma
    FROM public.players WHERE id = v_player_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     AND v_new_level IS DISTINCT FROM v_old_level;

  UPDATE public.players p SET
    name               = CASE WHEN input_payload ? 'name'               THEN nullif(btrim(input_payload->>'name'), '')               ELSE p.name END,
    -- email is INTENTIONALLY OMITTED — self-service change routes through supabase.auth.updateUser.
    phone              = CASE WHEN input_payload ? 'phone'              THEN nullif(btrim(input_payload->>'phone'), '')              ELSE p.phone END,
    birthday           = CASE WHEN input_payload ? 'birthday'           THEN nullif(input_payload->>'birthday', '')::date            ELSE p.birthday END,
    country            = CASE WHEN input_payload ? 'country'            THEN nullif(btrim(input_payload->>'country'), '')            ELSE p.country END,
    gender             = CASE WHEN input_payload ? 'gender'             THEN nullif(btrim(input_payload->>'gender'), '')             ELSE p.gender END,
    is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
    preferred_position = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
    playtomic_level    = v_new_level,
    adjusted_level     = v_new_level,
    playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
    tagline            = CASE WHEN input_payload ? 'tagline'            THEN nullif(btrim(input_payload->>'tagline'), '')            ELSE p.tagline END,
    tagline_label      = CASE WHEN input_payload ? 'tagline_label'      THEN nullif(btrim(input_payload->>'tagline_label'), '')      ELSE p.tagline_label END,
    avatar_url         = CASE WHEN input_payload ? 'avatar_url'         THEN nullif(btrim(input_payload->>'avatar_url'), '')         ELSE p.avatar_url END,
    playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
  WHERE p.id = v_player_id;

  IF v_level_changed THEN
    PERFORM public.record_mm_reset(
      v_player_id, v_new_level,
      coalesce(v_old_mm, v_old_level), coalesce(v_old_sigma, 0.7), 'self_reset'
    );
  END IF;

  RETURN true;
END
$function$;

-- admin_update_player: strip adjustment; level edit resets the prior.
CREATE OR REPLACE FUNCTION public.admin_update_player(input_target_id uuid, input_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_old_level     numeric;
  v_old_mm        numeric;
  v_old_sigma     numeric;
  v_new_level     numeric;
  v_level_changed boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_id IS NULL OR input_payload IS NULL THEN RETURN false; END IF;

  SELECT playtomic_level, mm_rating, mm_sigma
    INTO v_old_level, v_old_mm, v_old_sigma
    FROM public.players WHERE id = input_target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     AND v_new_level IS DISTINCT FROM v_old_level;

  UPDATE public.players p SET
    name = CASE WHEN input_payload ? 'name' THEN nullif(btrim(input_payload->>'name'), '') ELSE p.name END,
    email = CASE WHEN input_payload ? 'email' THEN nullif(btrim(input_payload->>'email'), '') ELSE p.email END,
    phone = CASE WHEN input_payload ? 'phone' THEN nullif(btrim(input_payload->>'phone'), '') ELSE p.phone END,
    notes = CASE WHEN input_payload ? 'notes' THEN nullif(btrim(input_payload->>'notes'), '') ELSE p.notes END,
    playtomic_level = v_new_level,
    adjusted_level = v_new_level,
    playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
    gender = CASE WHEN input_payload ? 'gender' THEN nullif(btrim(input_payload->>'gender'), '') ELSE p.gender END,
    status = CASE WHEN input_payload ? 'status' THEN nullif(btrim(input_payload->>'status'), '') ELSE p.status END,
    is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
    country = CASE WHEN input_payload ? 'country' THEN nullif(btrim(input_payload->>'country'), '') ELSE p.country END,
    avatar_url = CASE WHEN input_payload ? 'avatar_url' THEN nullif(btrim(input_payload->>'avatar_url'), '') ELSE p.avatar_url END,
    birthday = CASE WHEN input_payload ? 'birthday' THEN nullif(input_payload->>'birthday', '')::date ELSE p.birthday END,
    preferred_position = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
    tagline = CASE WHEN input_payload ? 'tagline' THEN nullif(btrim(input_payload->>'tagline'), '') ELSE p.tagline END,
    tagline_label = CASE WHEN input_payload ? 'tagline_label' THEN nullif(btrim(input_payload->>'tagline_label'), '') ELSE p.tagline_label END,
    playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
  WHERE p.id = input_target_id;

  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (input_target_id, 'admin_action', true);

  IF v_level_changed THEN
    PERFORM public.record_mm_reset(
      input_target_id, v_new_level,
      coalesce(v_old_mm, v_old_level), coalesce(v_old_sigma, 0.7), 'admin_edit'
    );
  END IF;

  RETURN true;
END
$function$;

-- ── 11. NOT Matchmaking V2: restore write privileges on public.settings ──────
-- Pre-existing production bug, unrelated to this feature and fixed here only
-- because it ships in the same push.
--
-- Phase C (20260518000008) ran REVOKE ALL then re-granted per table, but listed
-- settings only under GRANT SELECT — it was omitted from the INSERT/UPDATE/DELETE
-- grant. Table privileges are checked before RLS, so every client write to
-- settings has failed with "permission denied for table settings" (403) since
-- then, for admins included. settings_admin_write was never reached.
--
-- Writes stay admin-only: RLS is enabled on settings and settings_admin_write
-- (FOR ALL, USING + WITH CHECK on app_metadata.role = 'admin') is the only
-- policy covering INSERT/UPDATE. settings_read_all is SELECT-only.
--
-- INSERT is required alongside UPDATE because the client saves via upsert.
-- No DELETE: the single settings row is never removed from the client.
GRANT INSERT, UPDATE ON public.settings TO authenticated;

-- ── 12. NOT Matchmaking V2: results-reveal gate (D-029) ──────────────────────
-- Also not a V2 change, folded in here for the same reason as §11: it costs
-- nothing extra since this migration hasn't reached prod yet. `completed`
-- keeps meaning "scores locked + ratings computed"; this column is a second,
-- independent gate on when non-admin players see the final ranking/winner —
-- admins always see it. Client writes it through the existing `updateTournament`
-- path (same allowlist as `completed_at`/`status`), not a new RPC: a single-
-- column write on one row has none of the multi-row atomicity concerns D-016
-- gated the rating surfaces on.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS results_shared_at timestamptz;

COMMENT ON COLUMN public.tournaments.results_shared_at IS
  'When the admin revealed final standings to players (D-029). Null = pending_reveal for a completed tournament; admins always see rankings regardless.';

-- Backfill so nothing already-public gets newly hidden: every tournament that
-- was already completed as of this migration is treated as already revealed.
-- Only tournaments completed AFTER this ships start in pending_reveal.
UPDATE public.tournaments
  SET results_shared_at = coalesce(completed_at, now())
  WHERE status = 'completed' AND results_shared_at IS NULL;

-- ── 13. tournaments.format cutover (D-020) ───────────────────────────────────
-- D-020 removed the format picker from the UI, but the column default stayed
-- 'americano' from init.sql — so any insert omitting `format` produced an event
-- the V2 matcher would not serve, silently routing it to the legacy generator.
-- The client always sends 'lobster_matching' now; this closes the DB-side hole
-- so the two can't drift again.
ALTER TABLE public.tournaments
  ALTER COLUMN format SET DEFAULT 'lobster_matching';

-- No-op in production (all 6 rows are already 'lobster_matching'); this repairs
-- local/seed rows created under the old default. Deliberately unconditional on
-- status: `format` only drives generation, so rewriting it on a completed event
-- cannot change any already-saved match or ranking.
UPDATE public.tournaments
  SET format = 'lobster_matching'
  WHERE format IS DISTINCT FROM 'lobster_matching';
