-- Signed-out visitors (anon) read only what the guest pages show (#150).
--
-- Before this, anon held SELECT on most public tables, and their read
-- policies are `using (true)` for every role, so the public API key returned
-- registrations, payment status, Oscars votes, merch orders, transfers, the
-- player roster and every event column. Guest pages now read:
--   - tournaments: the event-card columns (publicEventQueries, link previews)
--   - public_tournament_registration_counts: spots taken
--   - settings: group name and tips (no WhatsApp link; see get_group_link)
--   - leagues: name and status of published leagues (Home's league card)
-- plus two security-definer functions: get_group_link and signup_name_match.
-- Members (authenticated) keep exactly the access they had.

-- ── 1. Deny-all baseline for anon ────────────────────────────────────────
-- PUBLIC too: a grant to PUBLIC would reach anon by membership (see
-- 20260727194010 for the same trap with functions).
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from public;

-- ── 2. What guest pages read ─────────────────────────────────────────────
grant select (
  id, name, date, time, duration, location, format, status, notes,
  max_players, total_price, entry_mode
) on public.tournaments to anon;

grant select on public.public_tournament_registration_counts to anon;

grant select (id, group_name, padel_tips) on public.settings to anon;

-- leagues_read already limits anon to published leagues. created_at picks the
-- current one (pickCurrentLeague).
grant select (id, name, status, published_at, created_at) on public.leagues to anon;

-- ── 3. WhatsApp group link, on request only ──────────────────────────────
-- Kept out of readable columns and page HTML so crawlers don't collect it.
-- Anyone may still ask for it (owner: outsiders are welcome to join).
create or replace function public.get_group_link()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(s.whatsapp_link), '') from public.settings s where s.id = 1
$$;

revoke all on function public.get_group_link() from public, anon, authenticated;
grant execute on function public.get_group_link() to anon, authenticated, service_role;

-- ── 4. Signup's "is that you?" check without the roster ──────────────────
-- Same name normalisation as self_signup_player and the before-user-created
-- hook. Returns 'placeholder', 'member' or 'none'; never a name or ID.
create or replace function public.signup_name_match(input_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with typed as (
    select lower(regexp_replace(btrim(coalesce(input_name, '')), '\s+', ' ', 'g')) as name
  )
  select case
    when position(' ' in t.name) = 0 then 'none'
    when exists (
      select 1 from public.players p
       where p.status = 'placeholder'
         and lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = t.name
    ) then 'placeholder'
    when exists (
      select 1 from public.players p
       where lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = t.name
    ) then 'member'
    else 'none'
  end
  from typed t
$$;

revoke all on function public.signup_name_match(text) from public, anon, authenticated;
grant execute on function public.signup_name_match(text) to anon, authenticated, service_role;
