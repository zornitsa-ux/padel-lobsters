-- The people behind auth_integrity.sql's follow-up counts: active players with
-- no real email (admins contact each one) and abandoned native signups.
-- Contains names, so its output stays out of PRs.
select 'active_player_without_real_email' as kind, p.id, p.name as label, p.created_at
  from public.players p
 where p.status = 'active'
   and (btrim(coalesce(p.email, '')) = '' or p.email ilike '%@padelobsters.internal')
union all
select 'unconfirmed_auth_account_older_than_30m', u.id,
       coalesce(u.raw_user_meta_data ->> 'name', '(no name)'), u.created_at
  from auth.users u
 where u.email_confirmed_at is null and u.created_at < now() - interval '30 minutes'
 order by kind, created_at;
