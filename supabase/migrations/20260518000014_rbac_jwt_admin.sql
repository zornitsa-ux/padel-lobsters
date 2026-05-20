-- JWT-based admin checks: replace is_admin() SECURITY DEFINER with JWT claim
--
-- app_metadata.role is baked into every JWT by the verify-pin edge function
-- (Phase 2, updated in Phase 7 alongside device_trusted). Reading the claim
-- directly eliminates the is_admin() SECURITY DEFINER function, removing a
-- privileged DB query from every admin policy evaluation.
--
-- Staleness trade-off: if a player's role changes mid-session, the RLS check
-- reflects the new role only after the next token refresh. For this app's
-- threat model (small trusted admin team) this is acceptable. If immediate
-- revocation is ever needed, force sign-out via the Auth Admin API in
-- admin_update_player when role is changed.
--
-- Deployment: this migration requires that the verify-pin edge function
-- already writes app_metadata.role on every login (Phase 2 — confirmed).

-- ── 1. Update require_admin() to read JWT claim ──────────────────────────────
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'unauthorized: admin required';
  END IF;
END;
$$;

-- ── 2. Replace all admin table policies ──────────────────────────────────────

DROP POLICY IF EXISTS players_admin_all              ON public.players;
DROP POLICY IF EXISTS tournaments_admin_write        ON public.tournaments;
DROP POLICY IF EXISTS matches_admin_write            ON public.matches;
DROP POLICY IF EXISTS registrations_admin_write      ON public.registrations;
DROP POLICY IF EXISTS settings_admin_write           ON public.settings;
DROP POLICY IF EXISTS league_interests_admin_write   ON public.league_interests;
DROP POLICY IF EXISTS league_teams_admin_write       ON public.league_teams;
DROP POLICY IF EXISTS merch_items_admin_write        ON public.merch_items;
DROP POLICY IF EXISTS merch_interests_admin_write    ON public.merch_interests;
DROP POLICY IF EXISTS player_aliases_admin_write     ON public.player_aliases;
DROP POLICY IF EXISTS lobster_oscars_sessions_admin_write    ON public.lobster_oscars_sessions;
DROP POLICY IF EXISTS lobster_oscars_categories_admin_write  ON public.lobster_oscars_categories;
DROP POLICY IF EXISTS lobster_oscars_votes_admin_write       ON public.lobster_oscars_votes;
DROP POLICY IF EXISTS registration_transfers_admin_write     ON public.registration_transfers;
DROP POLICY IF EXISTS raffle_winners_admin_write     ON public.raffle_winners;
DROP POLICY IF EXISTS leagues_admin_write            ON public.leagues;

CREATE POLICY players_admin_all ON public.players
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY tournaments_admin_write ON public.tournaments
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY matches_admin_write ON public.matches
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY registrations_admin_write ON public.registrations
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY settings_admin_write ON public.settings
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY league_interests_admin_write ON public.league_interests
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY league_teams_admin_write ON public.league_teams
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY merch_items_admin_write ON public.merch_items
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY merch_interests_admin_write ON public.merch_interests
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY player_aliases_admin_write ON public.player_aliases
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY lobster_oscars_sessions_admin_write ON public.lobster_oscars_sessions
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY lobster_oscars_categories_admin_write ON public.lobster_oscars_categories
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY lobster_oscars_votes_admin_write ON public.lobster_oscars_votes
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY registration_transfers_admin_write ON public.registration_transfers
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY raffle_winners_admin_write ON public.raffle_winners
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY leagues_admin_write ON public.leagues
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 3. Replace storage admin policies ────────────────────────────────────────

DROP POLICY IF EXISTS "Player or admin upload avatar" ON storage.objects;
DROP POLICY IF EXISTS "Player or admin update avatar" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload merch"            ON storage.objects;
DROP POLICY IF EXISTS "Admin update merch"            ON storage.objects;
DROP POLICY IF EXISTS "Admin delete merch"            ON storage.objects;

CREATE POLICY "Player or admin upload avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      name = 'player-' || auth.uid()::text || '.webp'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Player or admin update avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      name = 'player-' || auth.uid()::text || '.webp'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Admin upload merch" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merch' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin update merch" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'merch' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admin delete merch" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'merch' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 4. Drop is_admin() — no longer referenced anywhere ───────────────────────
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;
DROP FUNCTION public.is_admin();
