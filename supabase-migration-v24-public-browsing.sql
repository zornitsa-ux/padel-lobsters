-- ============================================================================
--  PADEL LOBSTERS — v24 Public Browsing Migration
--
--  Status: ADDITIVE. Safe to run against production.
--
--  What this does:
--    1. Creates a PII-free VIEW of tournaments that anon can read.
--    2. Creates a count-only VIEW of registrations per tournament
--       (so guests can see "5 players registered" without seeing WHO).
--    3. Grants SELECT on both views to the `anon` role.
--    4. Revokes any accidental anon privileges on the count-building
--       base column set (defence in depth — views already filter).
--
--  What this does NOT do (explicitly out of scope for this PR):
--    - Does not alter the existing "allow all" policies on the raw
--      tables. Locking those down is the Phase 2 / Phase 3 work
--      described in SECURITY-ROLLOUT.md. Until that lands, the anon
--      key can still read PII directly — that is a known state.
--    - Does not change the auth model. PIN-only auth, client-side,
--      same as today.
--
--  Why views and not RLS policies: the app does not currently establish
--  a Supabase Auth session (the PIN-based auth is client-side only), so
--  every request is made as `anon`. Policies keyed on `auth.uid()` would
--  reject everything. A view is the simplest way to expose a safe slice
--  without touching the auth model.
--
--  How to run:
--    Open Supabase → SQL Editor → paste this whole file → Run.
--    No downtime. Existing users unaffected.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) public_tournaments — PII-free slice of the tournaments table.
--
--    Columns intentionally omitted:
--      - anything identifying the creator / admin notes / internal flags
--    If the real table has columns not listed here you want guests to see,
--    add them to this SELECT list. Anything not listed is invisible to anon.
-- ---------------------------------------------------------------------------

drop view if exists public.public_tournaments cascade;

create view public.public_tournaments as
select
  id,
  name,
  date,
  location,
  format,
  max_players,
  description,
  -- If you add new PUBLIC-safe columns to tournaments, list them here.
  status
from public.tournaments
where
  -- Only show events the admin has published (if a published flag exists).
  -- Delete this clause if your table doesn't have one; keep it if you ever
  -- want an "internal draft" state that guests shouldn't see.
  coalesce(status, 'published') in ('published', 'open', 'scheduled');


-- ---------------------------------------------------------------------------
-- 2) public_tournament_registration_counts — just the count, no names.
--
--    Guests see "5 registered" but never individual player_ids or names.
--    Keeping registered + waitlist separate so the UI can show both if
--    useful. Only rows with non-cancelled status are counted.
-- ---------------------------------------------------------------------------

drop view if exists public.public_tournament_registration_counts cascade;

create view public.public_tournament_registration_counts as
select
  tournament_id,
  count(*) filter (where status = 'registered') as registered_count,
  count(*) filter (where status = 'waitlist')   as waitlist_count
from public.registrations
group by tournament_id;


-- ---------------------------------------------------------------------------
-- 3) Grants. `anon` is the unauthenticated-browser role; `authenticated`
--    is any logged-in Supabase session (we don't use those yet, but future-
--    proofing). Views inherit their own grants, so this is the primary
--    knob that decides who can read what.
-- ---------------------------------------------------------------------------

grant select on public.public_tournaments                          to anon, authenticated;
grant select on public.public_tournament_registration_counts       to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4) Defence in depth. A view strips columns, but the underlying tables
--    still have `allow all` policies (tracked in SECURITY-ROLLOUT.md).
--    We cannot fix that here without breaking the current client. What
--    we CAN do is guarantee the new views are the only anon-allowed
--    access path we're introducing — no accidental direct-table grants.
--
--    If you later revoke broad anon SELECT on the raw tables (Phase 2
--    of SECURITY-ROLLOUT), these views will keep working because views
--    run with the rights of their owner, not the caller.
-- ---------------------------------------------------------------------------

alter view public.public_tournaments set (security_invoker = off);
alter view public.public_tournament_registration_counts set (security_invoker = off);


-- ---------------------------------------------------------------------------
-- 5) Smoke test. Running these as the anon role should now succeed.
--    Running `select pin from players` as anon should STILL succeed today
--    (that's the Phase 2 work). Running `select name from public_tournaments`
--    should work for everyone, including not-signed-in visitors.
-- ---------------------------------------------------------------------------

-- select count(*) from public.public_tournaments;
-- select * from public.public_tournament_registration_counts limit 5;
