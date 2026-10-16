#!/usr/bin/env bash
# ============================================================================
# Auth identity backfill and sync (20261015130000).
#
# Plants the three production drifts on seeded users (no identity row with
# providers [], no identity row with no providers key, an identity holding the
# synthetic email), replays the migration file itself, then checks the patched
# ensure_auth_user_for_player and sync_player_email_to_auth triggers. Everything
# runs inside one transaction that rolls back.
#
#   supabase/tests/auth_identities.sh
# ============================================================================
set -euo pipefail

migration="$(dirname "$0")/../migrations/20261015130000_backfill_auth_identities.sql"

{
  cat <<'SQL'
begin;

set local client_min_messages = notice;

create temp table planted on commit drop as
select id, row_number() over (order by id) as n
  from auth.users
 where email not like 'player-%@padelobsters.internal'
 order by id
 limit 3;

delete from auth.identities where user_id in (select id from planted where n in (1, 2));

update auth.users
   set raw_app_meta_data = '{"role": "player", "providers": []}'
 where id = (select id from planted where n = 1);

update auth.users
   set raw_app_meta_data = '{}'
 where id = (select id from planted where n = 2);

update auth.identities
   set identity_data = identity_data
                       || jsonb_build_object('email', format('player-%s@padelobsters.internal', user_id))
 where user_id = (select id from planted where n = 3);

do $$
begin
  if (select count(*) from auth.users u
       where not exists (select 1 from auth.identities i where i.user_id = u.id)) < 2 then
    raise exception 'setup: expected at least 2 identity-less users';
  end if;
end $$;
SQL
  cat "$migration"
  cat <<'SQL'

do $$
declare
  v_one     uuid := (select id from planted where n = 1);
  v_two     uuid := (select id from planted where n = 2);
  v_three   uuid := (select id from planted where n = 3);
  v_ident   auth.identities%rowtype;
  v_meta    jsonb;
  v_player  uuid;
  v_count   int;
begin
  -- CHECK 1: every auth user has an identity
  if exists (select 1 from auth.users u
              where not exists (select 1 from auth.identities i where i.user_id = u.id)) then
    raise exception 'CHECK 1 FAILED: identity-less users remain';
  end if;
  raise notice 'CHECK 1 ok: no identity-less users';

  -- CHECK 2: a backfilled row has GoTrue's shape
  select * into v_ident from auth.identities where user_id = v_one;
  if v_ident.provider <> 'email'
     or v_ident.provider_id <> v_one::text
     or (select array_agg(k order by k) from jsonb_object_keys(v_ident.identity_data) k)
        <> array['email', 'email_verified', 'phone_verified', 'sub']
     or v_ident.identity_data ->> 'sub' <> v_one::text
     or v_ident.identity_data ->> 'email' <> (select email from auth.users where id = v_one)
     or (v_ident.identity_data ->> 'email_verified')::boolean is not true
     or (v_ident.identity_data ->> 'phone_verified')::boolean is not false then
    raise exception 'CHECK 2 FAILED: %', row_to_json(v_ident);
  end if;
  raise notice 'CHECK 2 ok: backfill shape';

  -- CHECK 3: app_metadata gains provider(s) and keeps the role
  select raw_app_meta_data into v_meta from auth.users where id = v_one;
  if v_meta <> '{"role": "player", "provider": "email", "providers": ["email"]}'::jsonb then
    raise exception 'CHECK 3 FAILED: %', v_meta;
  end if;
  select raw_app_meta_data into v_meta from auth.users where id = v_two;
  if v_meta <> '{"provider": "email", "providers": ["email"]}'::jsonb then
    raise exception 'CHECK 3 FAILED (no providers key): %', v_meta;
  end if;
  raise notice 'CHECK 3 ok: app_metadata providers';

  -- CHECK 4: a stale synthetic identity email follows auth.users.email
  if (select identity_data ->> 'email' from auth.identities where user_id = v_three)
     <> (select email from auth.users where id = v_three) then
    raise exception 'CHECK 4 FAILED';
  end if;
  raise notice 'CHECK 4 ok: stale identity email synced';

  -- CHECK 5: idempotent
  select count(*) into v_count from auth.identities;
  perform private.sync_email_identity(id) from auth.users;
  if (select count(*) from auth.identities) <> v_count then
    raise exception 'CHECK 5 FAILED';
  end if;
  raise notice 'CHECK 5 ok: idempotent';

  -- CHECK 6: a new player gets an auth user and an identity
  insert into public.players (name, status, email)
  values ('Identity Probe', 'active', 'probe@test.invalid')
  returning id into v_player;
  select * into v_ident from auth.identities where user_id = v_player;
  if v_ident.identity_data ->> 'email' is distinct from 'probe@test.invalid'
     or (select raw_app_meta_data -> 'providers' from auth.users where id = v_player)
        <> '["email"]'::jsonb then
    raise exception 'CHECK 6 FAILED: %', row_to_json(v_ident);
  end if;
  raise notice 'CHECK 6 ok: ensure_auth_user_for_player creates the identity';

  -- CHECK 7: an admin email edit, and clearing it, carry through to the identity
  update public.players set email = 'probe2@test.invalid' where id = v_player;
  if (select identity_data ->> 'email' from auth.identities where user_id = v_player)
     <> 'probe2@test.invalid' then
    raise exception 'CHECK 7 FAILED (edit)';
  end if;
  update public.players set email = null where id = v_player;
  if (select identity_data ->> 'email' from auth.identities where user_id = v_player)
     <> format('player-%s@padelobsters.internal', v_player) then
    raise exception 'CHECK 7 FAILED (clear)';
  end if;
  raise notice 'CHECK 7 ok: email edits sync the identity';

  -- CHECK 8: the helper is not callable by API roles
  if has_function_privilege('anon', 'private.sync_email_identity(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.sync_email_identity(uuid)', 'execute') then
    raise exception 'CHECK 8 FAILED';
  end if;
  raise notice 'CHECK 8 ok: grants';
end $$;

rollback;
SQL
} | docker exec -i supabase_db_padel-lobsters psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
