-- ============================================================================
-- Avatar storage policies (20261124170000, docs/account-deletion AD4, C-5).
-- Storage writes with RETURNING and deletes only rows the caller can select:
-- a player sees and removes their stable file and the file their avatar_url
-- names (an admin's random upload), nobody else's. Admins see and remove any.
-- A deleted player can't remove or upload.
--
-- Invented players only. One transaction, rolled back.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < supabase/tests/avatar_storage.sql
-- ============================================================================

begin;

-- What the Storage API sets before its own deletes.
set local storage.allow_delete_query = 'true';

create function pg_temp.player(input_name text, input_avatar text default '',
                               input_role player_role default 'player') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.players(name, email, playtomic_level, gender, status, role, avatar_url)
  values (input_name, lower(replace(input_name, ' ', '.')) || '@example.test', 3, 'f', 'active',
          input_role, input_avatar)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.act(input_player uuid, input_admin boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', input_player, 'role', 'authenticated',
    'app_metadata', case when input_admin then json_build_object('role', 'admin') else '{}'::json end
  )::text, true);
end $$;

create function pg_temp.check(input_ok boolean, input_label text) returns void
language plpgsql as $$
begin
  if not coalesce(input_ok, false) then
    raise exception 'FAIL: %', input_label;
  end if;
  raise notice 'ok: %', input_label;
end $$;

create temp table ids(key text primary key, id uuid);
grant select on ids to authenticated;

insert into ids values
  ('ada', pg_temp.player('Ada Avatar',
     'http://127.0.0.1:54321/storage/v1/object/public/avatars/player-1700000000-ada.webp?v=1')),
  ('ben', pg_temp.player('Ben Avatar',
     'https://x.supabase.co/storage/v1/object/public/avatars/player-1700000000-ben.webp')),
  ('cleo', pg_temp.player('Cleo Avatar')),
  ('admin', pg_temp.player('Ann Admin', '', 'admin'));

insert into storage.objects (bucket_id, name)
select 'avatars', n from (values
  ('player-' || (select id from ids where key = 'ada') || '.webp'),
  ('player-1700000000-ada.webp'),
  ('player-' || (select id from ids where key = 'ben') || '.webp'),
  ('player-1700000000-ben.webp')) v(n);

create temp view avatar_names with (security_invoker = true) as
  select name from storage.objects where bucket_id = 'avatars' and name like 'player-%';
grant select on avatar_names to authenticated;

-- ── A player sees their own two files only ─────────────────────────────────

select pg_temp.act((select id from ids where key = 'ada'));
set local role authenticated;
select pg_temp.check(
  (select array_agg(name order by name) from avatar_names)
    = array['player-1700000000-ada.webp', 'player-' || (select id from ids where key = 'ada') || '.webp'],
  'a player sees their stable file and the one avatar_url names');
reset role;

-- ── Upload with RETURNING, as Storage does ─────────────────────────────────

select pg_temp.act((select id from ids where key = 'cleo'));
set local role authenticated;
with up as (
  insert into storage.objects (bucket_id, name)
  values ('avatars', 'player-' || (select id from ids where key = 'cleo') || '.webp')
  returning name)
select pg_temp.check((select count(*) = 1 from up), 'a player uploads their stable file');
reset role;

do $$
begin
  perform pg_temp.act((select id from ids where key = 'cleo'));
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('avatars', 'player-1700000000-cleo.webp');
  raise exception 'FAIL: a player uploaded under a random name';
exception when insufficient_privilege then
  raise notice 'ok: a player can''t upload under another name';
end $$;

-- ── Remove: own files only ─────────────────────────────────────────────────

select pg_temp.act((select id from ids where key = 'ada'));
set local role authenticated;
with gone as (
  delete from storage.objects where bucket_id = 'avatars' and name like 'player-%' returning name)
select pg_temp.check((select count(*) = 2 from gone), 'a player removes their own two files');
reset role;

select pg_temp.check(
  (select count(*) = 2 from storage.objects
    where name in ('player-' || (select id from ids where key = 'ben') || '.webp',
                   'player-1700000000-ben.webp')),
  'another player''s files are untouched');

-- ── Admins see and remove any ──────────────────────────────────────────────

select pg_temp.act((select id from ids where key = 'admin'), true);
set local role authenticated;
select pg_temp.check((select count(*) >= 3 from avatar_names), 'an admin sees every avatar');
with gone as (
  delete from storage.objects where bucket_id = 'avatars' and name = 'player-1700000000-ben.webp'
  returning name)
select pg_temp.check((select count(*) = 1 from gone), 'an admin removes a player''s photo');
reset role;

-- ── A deleted player can't remove ──────────────────────────────────────────

update public.players set status = 'deleted' where id = (select id from ids where key = 'ben');
select pg_temp.act((select id from ids where key = 'ben'));
set local role authenticated;
with gone as (
  delete from storage.objects where bucket_id = 'avatars' and name like 'player-%' returning name)
select pg_temp.check((select count(*) = 0 from gone), 'a deleted player removes nothing');
reset role;

rollback;
