-- Row sets shared by auth_integrity.sql (counts) and auth_integrity_details.sql
-- (the people behind them). integrity.sh prepends this to each file, so a count
-- and the names that explain it can't drift apart.
--
-- A "real" email is non-blank and not the synthetic @padelobsters.internal
-- address that ensure_auth_user_for_player gives players without one.
with real_players as (
  select p.id, p.status, lower(btrim(p.email)) as email
    from public.players p
   where btrim(coalesce(p.email, '')) <> ''
     and p.email not ilike '%@padelobsters.internal'
),
active_players_without_real_email as (
  select p.id, p.name, p.created_at
    from public.players p
   where p.status = 'active'
     and not exists (select 1 from real_players rp where rp.id = p.id)
),
stale_unconfirmed_auth_accounts as (
  select u.id, u.raw_user_meta_data, u.created_at
    from auth.users u
   where u.email_confirmed_at is null
     and u.created_at < now() - interval '1 hour'
)
