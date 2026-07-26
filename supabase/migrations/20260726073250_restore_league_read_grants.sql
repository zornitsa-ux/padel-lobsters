-- ── Restore public read grants on the league tables ─────────────────────────
--
-- Not a perf change; found while collapsing the home-screen league queries into
-- one request, which surfaced it because the bundled query touches both tables.
--
-- Same bug class as the settings grant fixed in 20260713000001 §11. Phase C
-- (20260518000008) ran `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,
-- authenticated` and then re-granted SELECT table by table. That list omitted
-- league_matches entirely, and named league_teams before 20260523000001 had
-- created it — so the grant applied to neither.
--
-- Production currently has both grants anyway, applied out of band and never
-- captured in a migration. The result is that `supabase db reset` produces a
-- database where the league feature is broken (PostgREST returns 401
-- "permission denied for table league_teams" to every reader) while production
-- works. This makes the schema reproducible again.
--
-- Public read is the documented intent for both tables: RLS is enabled and
-- league_teams_read / league_matches_read are both `FOR SELECT USING (true)`.
-- Writes stay revoked — mutations go through the SECURITY DEFINER league RPCs.
--
-- Idempotent, and a no-op against production where the grants already exist.

GRANT SELECT ON public.league_teams   TO anon, authenticated;
GRANT SELECT ON public.league_matches TO anon, authenticated;
