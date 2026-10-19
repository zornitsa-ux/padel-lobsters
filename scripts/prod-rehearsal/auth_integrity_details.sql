-- The people behind auth_integrity.sql's follow-up counts: active players with
-- no real email (admins contact each one) and abandoned native signups.
-- Contains names, so its output stays out of PRs, and integrity.sh only runs
-- it locally.
--
-- Not runnable on its own: integrity.sh prepends auth_sets.sql (the WITH).
select 'active_player_without_real_email' as kind, id, name as label, created_at
  from active_players_without_real_email
union all
select 'unconfirmed_auth_account_older_than_30m', id,
       coalesce(raw_user_meta_data ->> 'name', '(no name)'), created_at
  from stale_unconfirmed_auth_accounts
 order by kind, created_at;
