-- Security hardening Phase C: real RLS policies + grants reset
-- Postgres 17 supports SECURITY INVOKER on views (used below).

-- Clean out existing permissive policies on targeted tables
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'players','tournaments','matches','registrations','settings',
        'league_interests','league_teams','merch_items','merch_interests',
        'player_aliases','lobster_oscars_sessions','lobster_oscars_categories',
        'lobster_oscars_votes','registration_transfers','raffle_winners',
        'public_tournament_registration_counts','tournament_reminders_sent'
      ])
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- Enable RLS where it was disabled
ALTER TABLE public.tournament_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Reset grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Read-only grants (anon + authenticated)
GRANT SELECT ON
  public.tournaments,
  public.matches,
  public.registrations,
  public.settings,
  public.raffle_winners,
  public.registration_transfers,
  public.lobster_oscars_sessions,
  public.lobster_oscars_categories,
  public.lobster_oscars_votes,
  public.leagues,
  public.league_interests,
  public.league_teams,
  public.merch_items,
  public.merch_interests,
  public.player_aliases
TO anon, authenticated;

-- Views (read via views only for players)
GRANT SELECT ON public.players_public TO anon, authenticated;
GRANT SELECT ON public.public_tournament_registration_counts TO anon, authenticated;

-- Write grants for authenticated (RLS will gate by owner/admin)
GRANT INSERT, UPDATE, DELETE ON
  public.tournaments,
  public.matches,
  public.registrations,
  public.league_interests,
  public.league_teams,
  public.merch_items,
  public.merch_interests,
  public.player_aliases
TO authenticated;

-- Helper predicate for admin checks
-- (used inline in policies)

-- ── players ─────────────────────────────────────────────────────────────
CREATE POLICY players_admin_all ON public.players
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY players_self_read ON public.players
  FOR SELECT USING (id = auth.uid());

CREATE POLICY players_self_update ON public.players
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── tournaments ─────────────────────────────────────────────────────────
CREATE POLICY tournaments_read_all ON public.tournaments FOR SELECT USING (true);
CREATE POLICY tournaments_admin_write ON public.tournaments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── matches ─────────────────────────────────────────────────────────────
CREATE POLICY matches_read_all ON public.matches FOR SELECT USING (true);
CREATE POLICY matches_admin_write ON public.matches
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── registrations ───────────────────────────────────────────────────────
CREATE POLICY registrations_read_all ON public.registrations FOR SELECT USING (true);
CREATE POLICY registrations_self_insert ON public.registrations
  FOR INSERT WITH CHECK (player_id = auth.uid());
CREATE POLICY registrations_self_update ON public.registrations
  FOR UPDATE USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());
CREATE POLICY registrations_self_delete ON public.registrations
  FOR DELETE USING (player_id = auth.uid());
CREATE POLICY registrations_admin_write ON public.registrations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── settings ────────────────────────────────────────────────────────────
CREATE POLICY settings_read_all ON public.settings FOR SELECT USING (true);
CREATE POLICY settings_admin_write ON public.settings
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── league_* (currently low-priority; owner/admin model) ────────────────
CREATE POLICY league_interests_read_all ON public.league_interests FOR SELECT USING (true);
CREATE POLICY league_interests_self_write ON public.league_interests
  FOR ALL USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
CREATE POLICY league_interests_admin_write ON public.league_interests
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY league_teams_read_all ON public.league_teams FOR SELECT USING (true);
CREATE POLICY league_teams_self_write ON public.league_teams
  FOR ALL USING (proposer_id = auth.uid() OR invitee_id = auth.uid())
  WITH CHECK (proposer_id = auth.uid() OR invitee_id = auth.uid());
CREATE POLICY league_teams_admin_write ON public.league_teams
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── merch_items ─────────────────────────────────────────────────────────
CREATE POLICY merch_items_read_all ON public.merch_items FOR SELECT USING (true);
CREATE POLICY merch_items_admin_write ON public.merch_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── merch_interests ─────────────────────────────────────────────────────
CREATE POLICY merch_interests_read_all ON public.merch_interests FOR SELECT USING (true);
CREATE POLICY merch_interests_self_write ON public.merch_interests
  FOR ALL USING (player_id = auth.uid()::text) WITH CHECK (player_id = auth.uid()::text);
CREATE POLICY merch_interests_admin_write ON public.merch_interests
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── player_aliases ─────────────────────────────────────────────────────-
CREATE POLICY player_aliases_read_all ON public.player_aliases FOR SELECT USING (true);
CREATE POLICY player_aliases_self_write ON public.player_aliases
  FOR ALL USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
CREATE POLICY player_aliases_admin_write ON public.player_aliases
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── lobster oscars ─────────────────────────────────────────────────────-
CREATE POLICY lobster_oscars_sessions_read_all ON public.lobster_oscars_sessions FOR SELECT USING (true);
CREATE POLICY lobster_oscars_sessions_admin_write ON public.lobster_oscars_sessions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY lobster_oscars_categories_read_all ON public.lobster_oscars_categories FOR SELECT USING (true);
CREATE POLICY lobster_oscars_categories_admin_write ON public.lobster_oscars_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY lobster_oscars_votes_read_all ON public.lobster_oscars_votes FOR SELECT USING (true);
CREATE POLICY lobster_oscars_votes_self_write ON public.lobster_oscars_votes
  FOR ALL USING (voter_id = auth.uid()) WITH CHECK (voter_id = auth.uid());
CREATE POLICY lobster_oscars_votes_admin_write ON public.lobster_oscars_votes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── registration_transfers / raffle_winners (read all, admin write) ─────
CREATE POLICY registration_transfers_read_all ON public.registration_transfers FOR SELECT USING (true);
CREATE POLICY registration_transfers_admin_write ON public.registration_transfers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY raffle_winners_read_all ON public.raffle_winners FOR SELECT USING (true);
CREATE POLICY raffle_winners_admin_write ON public.raffle_winners
  FOR ALL USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'admin'));

-- ── Views: switch to security invoker (Postgres 17 supports this) ───────
ALTER VIEW public.players_public SET (security_invoker = true);
ALTER VIEW public.public_tournament_registration_counts SET (security_invoker = true);
