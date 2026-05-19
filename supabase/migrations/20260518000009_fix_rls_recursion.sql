-- Fix: infinite recursion in players RLS + related Phase C issues
--
-- Root cause #1 (players): players_admin_all policy queried public.players from
-- within a players RLS check → Postgres recursed infinitely (code 42P17).
--
-- Root cause #2 (all other tables): every *_admin_write policy queried
-- public.players directly. authenticated has no SELECT grant on players
-- (revoked in Phase C), so those sub-queries fail with "permission denied".
--
-- Root cause #3 (views): players_public was set security_invoker=true but anon
-- has no SELECT on players, so anon queries of the view fail.
--
-- Fix: introduce is_admin() SECURITY DEFINER. Because it runs as the function
-- owner it bypasses RLS on players entirely, breaking the recursion and
-- removing the need for callers to hold SELECT on players.

-- ── 1. is_admin() helper ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- Both roles need EXECUTE so policy expressions can call it
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ── 2. Replace every admin policy inline subquery with is_admin() ───────────

-- players
DROP POLICY IF EXISTS players_admin_all ON public.players;
CREATE POLICY players_admin_all ON public.players
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tournaments
DROP POLICY IF EXISTS tournaments_admin_write ON public.tournaments;
CREATE POLICY tournaments_admin_write ON public.tournaments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- matches
DROP POLICY IF EXISTS matches_admin_write ON public.matches;
CREATE POLICY matches_admin_write ON public.matches
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- registrations
DROP POLICY IF EXISTS registrations_admin_write ON public.registrations;
CREATE POLICY registrations_admin_write ON public.registrations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- settings
DROP POLICY IF EXISTS settings_admin_write ON public.settings;
CREATE POLICY settings_admin_write ON public.settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- league_interests
DROP POLICY IF EXISTS league_interests_admin_write ON public.league_interests;
CREATE POLICY league_interests_admin_write ON public.league_interests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- league_teams
DROP POLICY IF EXISTS league_teams_admin_write ON public.league_teams;
CREATE POLICY league_teams_admin_write ON public.league_teams
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- merch_items
DROP POLICY IF EXISTS merch_items_admin_write ON public.merch_items;
CREATE POLICY merch_items_admin_write ON public.merch_items
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- merch_interests
DROP POLICY IF EXISTS merch_interests_admin_write ON public.merch_interests;
CREATE POLICY merch_interests_admin_write ON public.merch_interests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- player_aliases
DROP POLICY IF EXISTS player_aliases_admin_write ON public.player_aliases;
CREATE POLICY player_aliases_admin_write ON public.player_aliases
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- lobster_oscars_sessions
DROP POLICY IF EXISTS lobster_oscars_sessions_admin_write ON public.lobster_oscars_sessions;
CREATE POLICY lobster_oscars_sessions_admin_write ON public.lobster_oscars_sessions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- lobster_oscars_categories
DROP POLICY IF EXISTS lobster_oscars_categories_admin_write ON public.lobster_oscars_categories;
CREATE POLICY lobster_oscars_categories_admin_write ON public.lobster_oscars_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- lobster_oscars_votes
DROP POLICY IF EXISTS lobster_oscars_votes_admin_write ON public.lobster_oscars_votes;
CREATE POLICY lobster_oscars_votes_admin_write ON public.lobster_oscars_votes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- registration_transfers
DROP POLICY IF EXISTS registration_transfers_admin_write ON public.registration_transfers;
CREATE POLICY registration_transfers_admin_write ON public.registration_transfers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- raffle_winners
DROP POLICY IF EXISTS raffle_winners_admin_write ON public.raffle_winners;
CREATE POLICY raffle_winners_admin_write ON public.raffle_winners
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 3. Fix leagues table ─────────────────────────────────────────────────────
-- leagues was not in the Phase C cleanup list; old wide-open policies remain.
DROP POLICY IF EXISTS "leagues anon delete" ON public.leagues;
DROP POLICY IF EXISTS "leagues anon insert" ON public.leagues;
DROP POLICY IF EXISTS "leagues anon read"   ON public.leagues;
DROP POLICY IF EXISTS "leagues anon update" ON public.leagues;

CREATE POLICY leagues_read_all   ON public.leagues FOR SELECT USING (true);
CREATE POLICY leagues_admin_write ON public.leagues
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 4. Revert view security model ───────────────────────────────────────────
-- players_public: security_invoker=true + no SELECT grant on players for anon
-- = broken. Default view security (owner's permissions) is correct here because
-- the view intentionally strips PII columns and must be readable by anon.
ALTER VIEW public.players_public SET (security_invoker = false);
-- public_tournament_registration_counts only reads registrations (anon has
-- SELECT on that), so security_invoker would work, but keep consistent.
ALTER VIEW public.public_tournament_registration_counts SET (security_invoker = false);
