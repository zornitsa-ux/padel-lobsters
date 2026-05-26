-- League schema, RLS, and permissions.

-- ── Tables ────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.league_matches CASCADE;
DROP TABLE IF EXISTS public.league_teams CASCADE;

CREATE TABLE public.league_teams (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id            uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  division             text NOT NULL CHECK (division IN ('mens','womens')),
  player1_id           uuid NOT NULL REFERENCES public.players(id),
  player2_id           uuid NOT NULL REFERENCES public.players(id),
  team_name            text,
  team_song            text,
  spirit_animal        text,
  experience_level     text NOT NULL CHECK (experience_level IN ('beginner','intermediate','advanced')),
  preferred_play_times text,
  group_label          text CHECK (group_label IN ('A','B')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_different_players CHECK (player1_id <> player2_id)
);

CREATE TABLE public.league_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  division    text NOT NULL CHECK (division IN ('mens','womens')),
  stage       text NOT NULL CHECK (stage IN ('group','gold_semi','silver_semi','gold_final','silver_final')),
  team1_id    uuid REFERENCES public.league_teams(id),
  team2_id    uuid REFERENCES public.league_teams(id),  -- NULL = bye slot
  set_scores  jsonb,
  winner_id   uuid REFERENCES public.league_teams(id),
  played_on   date,
  location    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leagues ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX league_teams_by_league   ON public.league_teams(league_id, division);
CREATE INDEX league_matches_by_league ON public.league_matches(league_id, division);
CREATE INDEX league_matches_unplayed  ON public.league_matches(league_id, division) WHERE winner_id IS NULL;

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE public.league_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY;

-- Anyone can read league data.
CREATE POLICY "league_teams_read"   ON public.league_teams   FOR SELECT USING (true);
CREATE POLICY "league_matches_read" ON public.league_matches FOR SELECT USING (true);

-- All mutations require an admin JWT claim.  All writes also go through
-- SECURITY DEFINER RPCs; the FOR ALL policy is a defense-in-depth layer.
-- WITH CHECK is explicit so INSERT/UPDATE restrictions are unambiguous.
CREATE POLICY "league_teams_admin_write" ON public.league_teams
  FOR ALL
  USING     ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "league_matches_admin_write" ON public.league_matches
  FOR ALL
  USING     ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Belt-and-suspenders: revoke direct write access so the only mutation path
-- is through SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.league_teams   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.league_matches FROM anon, authenticated;

-- ── Player column grant ───────────────────────────────────────────────────────
-- League queries join league_teams → players to display names and avatars.
-- The column-level grant is the access boundary: only these four columns are
-- readable by anon/authenticated even with the permissive row policy below.
-- Sensitive columns (pin, pin_hash, email, phone) are not listed and remain
-- inaccessible via the REST API.  Any future column added to players requires
-- an explicit column grant here to become readable by anon.
GRANT SELECT (id, name, avatar_url, status) ON public.players TO anon, authenticated;

CREATE POLICY "players_public_fields_read"
  ON public.players
  FOR SELECT
  USING (true);
