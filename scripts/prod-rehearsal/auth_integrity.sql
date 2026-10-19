-- Auth integrity counts (docs/pin-auth-removal/PLAN.md §4.5).
--
-- One read-only statement, so it runs unchanged against the local stack and,
-- via `supabase db query --linked`, against production. It returns counts only,
-- which is safe to paste into a PR. auth_integrity_details.sql names the people
-- behind the counts that need follow-up.
--
-- A "real" email is non-blank and not the synthetic @padelobsters.internal
-- address that ensure_auth_user_for_player gives players without one.
with real_players as (
  select p.id, p.status, lower(btrim(p.email)) as email
    from public.players p
   where btrim(coalesce(p.email, '')) <> ''
     and p.email not ilike '%@padelobsters.internal'
)
select check_name, value
  from (values
    (1, 'players_without_auth_account',
        (select count(*) from public.players p
          where not exists (select 1 from auth.users u where u.id = p.id))),
    (2, 'confirmed_auth_accounts_without_player',
        (select count(*) from auth.users u
          where u.email_confirmed_at is not null
            and not exists (select 1 from public.players p where p.id = u.id))),
    (3, 'unconfirmed_auth_accounts_older_than_30m',
        (select count(*) from auth.users
          where email_confirmed_at is null and created_at < now() - interval '30 minutes')),
    (4, 'duplicate_auth_emails',
        (select count(*) from (select lower(email) from auth.users
                                 where email is not null group by 1 having count(*) > 1) d)),
    (5, 'duplicate_real_player_emails',
        (select count(*) from (select email from real_players group by 1 having count(*) > 1) d)),
    (6, 'real_player_email_differs_from_auth',
        (select count(*) from real_players rp join auth.users u on u.id = rp.id
          where rp.email is distinct from lower(u.email))),
    (7, 'auth_accounts_without_identity',
        (select count(*) from auth.users u
          where not exists (select 1 from auth.identities i where i.user_id = u.id))),
    (8, 'stale_identity_email',
        (select count(*) from auth.identities i join auth.users u on u.id = i.user_id
          where i.provider = 'email'
            and lower(i.identity_data ->> 'email') is distinct from lower(u.email))),
    (9, 'empty_providers',
        (select count(*) from auth.users
          where coalesce(raw_app_meta_data -> 'providers', '[]'::jsonb) = '[]'::jsonb)),
    (10, 'anonymous_sso_banned_or_deleted',
        (select count(*) from auth.users
          where is_anonymous or is_sso_user or banned_until > now() or deleted_at is not null)),
    (11, 'active_players_without_real_email',
        (select count(*) from public.players p
          where p.status = 'active' and not exists (select 1 from real_players rp where rp.id = p.id))),
    (12, 'players_without_real_email',
        (select count(*) from public.players p
          where not exists (select 1 from real_players rp where rp.id = p.id))),
    (13, 'synthetic_auth_accounts',
        (select count(*) from auth.users where email ilike '%@padelobsters.internal')),
    (14, 'blank_player_emails',
        (select count(*) from public.players where email is not null and btrim(email) = '')),
    (15, 'password_hashes',
        (select count(*) from auth.users where coalesce(encrypted_password, '') <> ''))
  ) as v(n, check_name, value)
 order by n;
