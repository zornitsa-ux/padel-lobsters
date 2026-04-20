-- ============================================================================
--  v21 — League Admin: a second, scoped-down admin role
--
--  The main admin can hand out a separate "League Admin" PIN to someone who
--  should be able to manage the Lobster League (create the league, set
--  dates, dissolve teams) but NOT the wider admin surface (tournaments,
--  players, schedule, scores, payments, etc.).
--
--  We add a plain `league_admin_pin` column to settings — anyone entering
--  this PIN in the sign-in gate becomes a "league admin" for the session.
--  The app gates the League page's admin controls on
--    isAdmin  ||  isLeagueAdmin
--  and everything else on
--    isAdmin   (only)
--
--  Idempotent — safe to re-run.
-- ============================================================================

alter table settings
  add column if not exists league_admin_pin text default '';

-- No RPC / hashing for now: the league admin PIN follows the same trust
-- model as the pre-v14 admin PIN — stored in the settings row, compared
-- client-side against what the user typed. Upgrading to hashed storage +
-- a verify_league_admin_pin RPC is a straightforward follow-up if needed.
