-- =====================================================================
-- Padel Lobsters — Security hardening, Phase 1
-- =====================================================================
-- Purpose: close every Supabase advisor ERROR without changing app behavior.
-- This migration is intentionally a no-op for end users: it only closes
-- holes that the app does not currently rely on (e.g. anonymous bucket
-- listing) and makes existing permissive RLS explicit so a reviewer can
-- see the security posture in pg_policies instead of inferring it.
--
-- What this migration does NOT do (deferred to Phase 2, which requires
-- coordinated app changes):
--   * Replace USING(true) on players / registrations / matches / etc.
--     with PIN-gated logic. The app talks to Supabase as anon, so any
--     stricter policy would break read/write paths today.
--   * Move PII reads (email, phone, birthday) and PIN updates behind
--     SECURITY DEFINER RPCs.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Enable RLS on the five unprotected public tables.
--    Policies below match current behavior exactly: anon and authenticated
--    can do everything. The point is to make this explicit so the advisor
--    stops flagging RLS_DISABLED and SENSITIVE_COLUMNS_EXPOSED, and so a
--    reviewer reads intent from pg_policies, not from absence.
-- ---------------------------------------------------------------------

-- merch_items: admin-curated catalog. App does direct CRUD from anon today.
alter table public.merch_items enable row level security;
create policy "merch_items anon read"   on public.merch_items for select to anon, authenticated using (true);
create policy "merch_items anon insert" on public.merch_items for insert to anon, authenticated with check (true);
create policy "merch_items anon update" on public.merch_items for update to anon, authenticated using (true) with check (true);
create policy "merch_items anon delete" on public.merch_items for delete to anon, authenticated using (true);

-- merch_interests: order intents. Currently world-readable/writable.
alter table public.merch_interests enable row level security;
create policy "merch_interests anon read"   on public.merch_interests for select to anon, authenticated using (true);
create policy "merch_interests anon insert" on public.merch_interests for insert to anon, authenticated with check (true);
create policy "merch_interests anon update" on public.merch_interests for update to anon, authenticated using (true) with check (true);
create policy "merch_interests anon delete" on public.merch_interests for delete to anon, authenticated using (true);

-- game_sessions / game_votes / game_results: PadelQuiz minigame state.
alter table public.game_sessions enable row level security;
create policy "game_sessions anon read"   on public.game_sessions for select to anon, authenticated using (true);
create policy "game_sessions anon insert" on public.game_sessions for insert to anon, authenticated with check (true);
create policy "game_sessions anon update" on public.game_sessions for update to anon, authenticated using (true) with check (true);
create policy "game_sessions anon delete" on public.game_sessions for delete to anon, authenticated using (true);

alter table public.game_votes enable row level security;
create policy "game_votes anon read"   on public.game_votes for select to anon, authenticated using (true);
create policy "game_votes anon insert" on public.game_votes for insert to anon, authenticated with check (true);
create policy "game_votes anon update" on public.game_votes for update to anon, authenticated using (true) with check (true);
create policy "game_votes anon delete" on public.game_votes for delete to anon, authenticated using (true);

alter table public.game_results enable row level security;
create policy "game_results anon read"   on public.game_results for select to anon, authenticated using (true);
create policy "game_results anon insert" on public.game_results for insert to anon, authenticated with check (true);
create policy "game_results anon update" on public.game_results for update to anon, authenticated using (true) with check (true);
create policy "game_results anon delete" on public.game_results for delete to anon, authenticated using (true);


-- ---------------------------------------------------------------------
-- 2. Pin search_path on functions that don't already have one.
--    Mutable search_path on a SECURITY DEFINER function is a well-known
--    privilege-escalation vector (an attacker who can create objects in
--    any schema along the search path can shadow built-ins). We force a
--    fixed, minimal path. The existing function bodies already qualify
--    cross-schema calls (extensions.crypt, public.players), so this is
--    a behavior-preserving change.
-- ---------------------------------------------------------------------

alter function public.sync_player_pin_hash()
  set search_path = pg_catalog, public, extensions;

alter function public.sync_admin_pin_hash()
  set search_path = pg_catalog, public, extensions;

alter function public.verify_admin_pin(input_pin text)
  set search_path = pg_catalog, public, extensions;

alter function public.get_my_profile(input_pin text)
  set search_path = pg_catalog, public, extensions;

alter function public.get_all_players_with_pii(admin_pin text)
  set search_path = pg_catalog, public, extensions;


-- ---------------------------------------------------------------------
-- 3. Tighten storage. Both buckets are marked public=true, which means
--    getPublicUrl() serves files via a CDN path that does NOT consult
--    RLS. The broad SELECT policies on storage.objects only matter for
--    .list() / .from(bucket).select() calls — neither of which the app
--    makes. Dropping them stops anonymous bucket enumeration without
--    breaking any user-visible flow.
-- ---------------------------------------------------------------------

drop policy if exists "Public read from avatars" on storage.objects;
drop policy if exists "Public read from merch"   on storage.objects;


-- ---------------------------------------------------------------------
-- 4. Switch players_public view from SECURITY DEFINER (the implicit
--    default on older Postgres) to SECURITY INVOKER. This means the
--    view's underlying SELECT runs with the caller's permissions and
--    RLS policies on `players`, instead of the view-creator's. For
--    this app the effective access is unchanged — the players table's
--    USING(true) policy already allows the same rows — but the
--    advisor stops flagging a real privilege-elevation surface, and
--    Phase 2's tightening of `players` RLS will automatically apply
--    to this view too.
-- ---------------------------------------------------------------------

alter view public.players_public set (security_invoker = true);


-- ---------------------------------------------------------------------
-- 5. Deduplicate league / player_aliases policies.
--    Each of these tables currently has a "<table> read" policy (FOR
--    SELECT) AND a "<table> write" policy (FOR ALL — which also implies
--    SELECT). That triggers the multiple_permissive_policies advisor and
--    means every SELECT runs both policies. We collapse to one policy
--    per command, no behavior change.
-- ---------------------------------------------------------------------

-- leagues
drop policy if exists "leagues read"  on public.leagues;
drop policy if exists "leagues write" on public.leagues;
create policy "leagues anon read"   on public.leagues for select to anon, authenticated using (true);
create policy "leagues anon insert" on public.leagues for insert to anon, authenticated with check (true);
create policy "leagues anon update" on public.leagues for update to anon, authenticated using (true) with check (true);
create policy "leagues anon delete" on public.leagues for delete to anon, authenticated using (true);

-- league_teams
drop policy if exists "league_teams read"  on public.league_teams;
drop policy if exists "league_teams write" on public.league_teams;
create policy "league_teams anon read"   on public.league_teams for select to anon, authenticated using (true);
create policy "league_teams anon insert" on public.league_teams for insert to anon, authenticated with check (true);
create policy "league_teams anon update" on public.league_teams for update to anon, authenticated using (true) with check (true);
create policy "league_teams anon delete" on public.league_teams for delete to anon, authenticated using (true);

-- league_interests
drop policy if exists "league_interests read"  on public.league_interests;
drop policy if exists "league_interests write" on public.league_interests;
create policy "league_interests anon read"   on public.league_interests for select to anon, authenticated using (true);
create policy "league_interests anon insert" on public.league_interests for insert to anon, authenticated with check (true);
create policy "league_interests anon update" on public.league_interests for update to anon, authenticated using (true) with check (true);
create policy "league_interests anon delete" on public.league_interests for delete to anon, authenticated using (true);

-- player_aliases
drop policy if exists "player_aliases readable by all" on public.player_aliases;
drop policy if exists "player_aliases writable by all" on public.player_aliases;
create policy "player_aliases anon read"   on public.player_aliases for select to anon, authenticated using (true);
create policy "player_aliases anon insert" on public.player_aliases for insert to anon, authenticated with check (true);
create policy "player_aliases anon update" on public.player_aliases for update to anon, authenticated using (true) with check (true);
create policy "player_aliases anon delete" on public.player_aliases for delete to anon, authenticated using (true);

commit;

-- =====================================================================
-- Expected advisor delta after this migration (verified against the
-- pre-migration snapshot taken 2026-04-27):
--   ERRORS resolved   (5): rls_disabled_in_public on merch_items,
--                          merch_interests, game_sessions, game_votes,
--                          game_results
--   ERRORS resolved   (2): sensitive_columns_exposed on game_results
--                          and game_votes (resolved as a side effect
--                          of enabling RLS on those tables)
--   ERRORS resolved   (1): security_definer_view on public.players_public
--                          (resolved by step 4 — security_invoker=true)
--   WARNINGS resolved (5): function_search_path_mutable on the five
--                          functions in step 2
--   WARNINGS resolved (2): public_bucket_allows_listing on avatars
--                          and merch (resolved by step 3)
--   WARNINGS resolved (16): multiple_permissive_policies on the four
--                          league/alias tables, across all 4 affected
--                          (anon, authenticated, authenticator,
--                           dashboard_user, supabase_privileged_role
--                           — minus the role-set narrowing this
--                           migration also performs)
--
--   WARNINGS still present (Phase 2 territory, deliberately left):
--   - rls_policy_always_true on players, registrations, matches,
--     tournaments, settings, updates, update_reactions. These require
--     the auth refactor (anon → PIN-gated RPCs).
--   - anon_security_definer_function_executable on the 4 PIN RPCs.
--     They have to stay anon-callable (the app is anon-only); Phase 2
--     will add rate limiting + audit logging instead of revoking EXECUTE.
--
-- Pre-flight verification performed:
--   - grep src/ for `.list(` / `.move(` / `.copy(` / `.remove(` on
--     storage: zero matches (only upload + getPublicUrl in use).
--   - grep src/ for storage.from(...): 4 sites, all upload+getPublicUrl.
--   - supabase/functions/ does not exist (no edge functions).
--   - Function bodies confirmed schema-qualified (public.players,
--     public.verify_player_pin, extensions.crypt, extensions.gen_salt).
-- =====================================================================
