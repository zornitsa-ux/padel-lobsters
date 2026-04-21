-- ============================================================================
--  PADEL LOBSTERS — v26 Public Tournaments View Fix
--
--  Status: ADDITIVE. Safe to run against production.
--
--  Why this exists:
--    The v24 migration created `public_tournaments` with the filter
--      where coalesce(status, 'published') in ('published','open','scheduled')
--    but the app has always written status values of 'upcoming', 'active',
--    and 'completed'. Result: the view returned zero rows to the `anon`
--    role, and logged-out visitors saw "No upcoming events right now"
--    on the landing page even when events existed.
--
--    This migration also expands the column set so the landing page can
--    render the same "Your Next Event" card signed-in members see —
--    time, duration, total_price (for per-person cost), notes, courts,
--    and court_booking_mode are now exposed. Still no admin/PII columns.
--
--  How to run:
--    Open Supabase → SQL Editor → paste this whole file → Run.
--    No downtime. Existing users unaffected. The view is recreated
--    atomically; any existing grants are restored below.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Recreate public_tournaments with the correct status filter and the
--    columns needed to render the Dashboard / guest landing.
-- ---------------------------------------------------------------------------

drop view if exists public.public_tournaments cascade;

create view public.public_tournaments as
select
  id,
  name,
  date,
  time,
  location,
  format,
  max_players,
  duration,
  total_price,
  court_booking_mode,
  notes,
  description,
  courts,
  status
from public.tournaments
where
  -- Exclude only completed events. 'upcoming' and 'active' both show
  -- up on the landing page; anything else (null, admin-draft labels,
  -- future custom statuses) defaults to visible. If you ever introduce
  -- a 'draft' status that guests shouldn't see, add it to the exclusion
  -- list here.
  coalesce(status, 'upcoming') <> 'completed';


-- ---------------------------------------------------------------------------
-- 2) Re-grant SELECT. `drop view ... cascade` drops the grants too.
-- ---------------------------------------------------------------------------

grant select on public.public_tournaments                          to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) Keep the count view's grants intact (no schema change, but v24's
--    `cascade` drop may have touched dependent objects — this is safe
--    to re-run).
-- ---------------------------------------------------------------------------

grant select on public.public_tournament_registration_counts       to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4) Defence in depth — keep the view owner-evaluated so it survives a
--    future anon-SELECT revoke on the raw tournaments table.
-- ---------------------------------------------------------------------------

alter view public.public_tournaments set (security_invoker = off);


-- ---------------------------------------------------------------------------
-- 5) Smoke test.
--    As anon: `select count(*) from public.public_tournaments` should
--    return the same count as
--      select count(*) from public.tournaments where status != 'completed';
-- ---------------------------------------------------------------------------

-- select count(*) from public.public_tournaments;
-- select id, name, date, status from public.public_tournaments order by date limit 5;
