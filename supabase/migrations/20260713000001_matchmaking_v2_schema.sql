-- Matchmaking V2 — Phase 3 M3.1: schema, tables, RPCs (DESIGN §5).
--
-- Adds the mm_* learned-rating columns, the rating_events audit trail, and the
-- schedule_runs provenance log. Writes to all three go through require_admin()
-- SECURITY DEFINER RPCs, NOT client direct writes (D-016): rating application
-- is multi-row transactional and carries invariants (applied_delta reflects
-- what hit mm_rating; review_status only advances null -> reviewed) that RLS
-- cannot express. matches keeps its existing RLS-gated delete+insert (D-016).
--
-- mm_* stays admin-only: excluded from players_public by that view's explicit
-- column list; admins read it via get_all_players_with_pii_v2 (SELECT *).

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

-- ── 8. Grants (functions gate internally via require_admin) ───────────────────
-- New functions inherit Supabase's default EXECUTE grant to anon/PUBLIC; reassert
-- security_phase_a's posture — only signed-in users reach the require_admin gate.
REVOKE EXECUTE ON FUNCTION public.admin_apply_tournament_ratings(jsonb)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_review_rating_event(uuid, text, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_record_schedule_run(jsonb)               FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_apply_tournament_ratings(jsonb)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_rating_event(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_schedule_run(jsonb)              TO authenticated;
