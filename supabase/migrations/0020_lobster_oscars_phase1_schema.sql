-- Lobster Oscars — phase 1: schema
-- Adds three new tables for the redesigned Lobster Games (async tile-based Oscars voting).
-- Old game_sessions / game_votes / game_results tables are intentionally left untouched.
--
-- Per Padel Lobsters security model: anon-only auth, all policies USING(true),
-- real protection comes from table grants (anon has no grant on lobster_oscars_votes)
-- and PIN-gated SECURITY DEFINER RPCs (added in phase 2).
--
-- Rename file to fit your migration sequence (e.g., 0027_lobster_oscars_phase1_schema.sql)
-- before committing to supabase/migrations/.

-- ============================================================================
-- 1. Sessions: one per tournament. Lifecycle = active → ended → shared.
-- ============================================================================
CREATE TABLE public.lobster_oscars_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ,
  closed_at     TIMESTAMPTZ,
  shared_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lobster_oscars_sessions_lifecycle_chk CHECK (
    (closed_at IS NULL OR started_at IS NOT NULL) AND
    (shared_at IS NULL OR closed_at  IS NOT NULL) AND
    (started_at IS NULL OR closed_at IS NULL OR closed_at >= started_at) AND
    (closed_at  IS NULL OR shared_at IS NULL OR shared_at >= closed_at)
  )
);

COMMENT ON TABLE  public.lobster_oscars_sessions IS 'One Lobster Oscars voting session per tournament. Lifecycle: created → started → ended → shared.';
COMMENT ON COLUMN public.lobster_oscars_sessions.started_at IS 'Set when admin starts the games. Voting allowed iff started_at IS NOT NULL AND closed_at IS NULL.';
COMMENT ON COLUMN public.lobster_oscars_sessions.closed_at  IS 'Set when admin ends the games. Voting locked. Players see "waiting for results"; admin sees rankings.';
COMMENT ON COLUMN public.lobster_oscars_sessions.shared_at  IS 'Set when admin shares results. Players now see winners. One-way valve — only admin sets this.';

-- ============================================================================
-- 2. Categories: admin-managed list per session.
-- ============================================================================
CREATE TABLE public.lobster_oscars_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.lobster_oscars_sessions(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '🦞',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lobster_oscars_categories_name_nonempty CHECK (length(btrim(name)) > 0)
);

CREATE INDEX lobster_oscars_categories_session_idx
  ON public.lobster_oscars_categories(session_id, display_order);

COMMENT ON TABLE public.lobster_oscars_categories IS 'Per-tournament Oscars categories (e.g., Best Smash, Best Outfit). Admin-editable before session starts.';

-- ============================================================================
-- 3. Votes: one row per (category, voter). Updates via upsert in RPC.
-- ============================================================================
CREATE TABLE public.lobster_oscars_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.lobster_oscars_categories(id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lobster_oscars_votes_no_self_vote      CHECK (voter_id <> target_id),
  CONSTRAINT lobster_oscars_votes_unique_per_voter  UNIQUE (category_id, voter_id)
);

-- Voter-side lookup ("which categories have I voted in for this session")
CREATE INDEX lobster_oscars_votes_voter_idx
  ON public.lobster_oscars_votes(voter_id);

-- Aggregate-side lookup ("count votes per target per category")
CREATE INDEX lobster_oscars_votes_target_idx
  ON public.lobster_oscars_votes(category_id, target_id);

COMMENT ON TABLE  public.lobster_oscars_votes IS 'Votes cast in Lobster Oscars. One row per (category, voter); updates via upsert in RPC. Self-vote blocked at DB level.';
COMMENT ON COLUMN public.lobster_oscars_votes.target_id IS 'The player being voted for. CHECK constraint blocks self-vote (voter_id <> target_id).';

-- ============================================================================
-- 4. updated_at trigger for votes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lobster_oscars_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lobster_oscars_votes_updated_at
  BEFORE UPDATE ON public.lobster_oscars_votes
  FOR EACH ROW EXECUTE FUNCTION public.lobster_oscars_set_updated_at();

-- ============================================================================
-- 5. Row Level Security: USING(true) per anon-only model.
--    Real protection is grants + RPCs (phase 2).
-- ============================================================================
ALTER TABLE public.lobster_oscars_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobster_oscars_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobster_oscars_votes      ENABLE ROW LEVEL SECURITY;

CREATE POLICY lobster_oscars_sessions_all   ON public.lobster_oscars_sessions   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY lobster_oscars_categories_all ON public.lobster_oscars_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY lobster_oscars_votes_all      ON public.lobster_oscars_votes      FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Grants. Anon can SELECT sessions and categories (frontend reads).
--    Anon has NO grants on votes — all access through SECURITY DEFINER RPCs (phase 2).
-- ============================================================================

-- Strip any defaults
REVOKE ALL ON public.lobster_oscars_sessions   FROM anon, authenticated;
REVOKE ALL ON public.lobster_oscars_categories FROM anon, authenticated;
REVOKE ALL ON public.lobster_oscars_votes      FROM anon, authenticated;

-- Anon: read-only on lookup tables, nothing on votes
GRANT SELECT ON public.lobster_oscars_sessions   TO anon;
GRANT SELECT ON public.lobster_oscars_categories TO anon;

-- Authenticated (unused in current app but hygiene): same as anon
GRANT SELECT ON public.lobster_oscars_sessions   TO authenticated;
GRANT SELECT ON public.lobster_oscars_categories TO authenticated;

-- service_role: full access for migrations and admin scripts
GRANT ALL ON public.lobster_oscars_sessions   TO service_role;
GRANT ALL ON public.lobster_oscars_categories TO service_role;
GRANT ALL ON public.lobster_oscars_votes      TO service_role;
