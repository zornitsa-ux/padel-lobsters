-- Constrain leagues.status to the four values the app actually understands.
--
-- The column has never had a CHECK constraint. It was created in
-- 20250503000000_init.sql with `default 'signups_open'` — a value that is not
-- in the app's LeagueStatus union ('draft' | 'group_stage' | 'knockout' |
-- 'completed') and not in admin_update_league_status's canonical order array.
-- 20260523000001 changed the default to 'draft', but nothing fixed the rows
-- already written under the old default.
--
-- Consequence in the app: PHASE_PILL / STATUS_BADGE are keyed by the raw
-- status string, and LeagueHome.tsx and LeagueDashboardCard.tsx destructure
-- the lookup without a fallback, so an unrecognised status is a TypeError
-- rather than a degraded badge. Those two call sites are being made total in
-- the same change as belt-and-braces; this constraint is the real fix.
--
-- Production held exactly one such row: 'Summer 2026 Lobster League'
-- (4516ebed-fc95-45f5-a607-f06f6f3a1f54, created 2026-04-20, status
-- 'signups_open'), a false start superseded by the 'Summer 2026' league
-- created 2026-05-26 that has since run to knockout. It had no teams and no
-- matches, but 3 league_interests rows, which cascade with it. Deleting it —
-- signups included — was confirmed by the owner with that cost stated.
--
-- Scoped to the specific id AND status so a re-run is a no-op and no other
-- row can be caught by it. If any further invalid row exists, the ADD
-- CONSTRAINT below fails loudly rather than deleting anything unexpected.
DELETE FROM public.leagues
 WHERE id = '4516ebed-fc95-45f5-a607-f06f6f3a1f54'
   AND status = 'signups_open';

-- Mirrors admin_update_league_status's v_order array (20260523000002) and the
-- app's LeagueStatus union. Adding a status means changing all three.
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_status_check
  CHECK (status IN ('draft', 'group_stage', 'knockout', 'completed'));
