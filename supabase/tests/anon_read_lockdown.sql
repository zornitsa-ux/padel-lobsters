-- ============================================================================
-- Signed-out visitors (anon) read only what the guest pages show (#150).
-- Fails on any anon column privilege outside the allowlist, and on any anon
-- write privilege. Widening guest access means editing the allowlist here and
-- the grants in a migration, together.
--
--   npm run db:test
-- ============================================================================

begin;

do $$
declare
  v_extra text;
  v_missing text;
  v_writes text;
begin
  create temp table allowed (rel text, col text) on commit drop;
  insert into allowed values
    ('tournaments', 'id'), ('tournaments', 'name'), ('tournaments', 'date'),
    ('tournaments', 'time'), ('tournaments', 'duration'), ('tournaments', 'location'),
    ('tournaments', 'format'), ('tournaments', 'status'), ('tournaments', 'notes'),
    ('tournaments', 'max_players'), ('tournaments', 'total_price'),
    ('tournaments', 'entry_mode'),
    ('settings', 'id'), ('settings', 'group_name'), ('settings', 'padel_tips'),
    ('leagues', 'id'), ('leagues', 'name'), ('leagues', 'status'),
    ('leagues', 'published_at'), ('leagues', 'created_at'),
    ('public_tournament_registration_counts', 'tournament_id'),
    ('public_tournament_registration_counts', 'registered_count'),
    ('public_tournament_registration_counts', 'cancelled_count'),
    ('public_tournament_registration_counts', 'total_count');

  create temp table readable on commit drop as
    select c.relname::text as rel, a.attname::text as col
      from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'v', 'm')
       and has_column_privilege('anon', c.oid, a.attnum, 'SELECT');

  select string_agg(rel || '.' || col, ', ' order by rel, col) into v_extra
    from (select * from readable except select * from allowed) x;
  if v_extra is not null then
    raise exception 'anon can read columns outside the allowlist: %', v_extra;
  end if;

  select string_agg(rel || '.' || col, ', ' order by rel, col) into v_missing
    from (select * from allowed except select * from readable) x;
  if v_missing is not null then
    raise exception 'guest pages need columns anon can''t read: %', v_missing;
  end if;

  select string_agg(c.relname || ':' || p.priv, ', ' order by c.relname, p.priv) into v_writes
    from pg_class c
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'v', 'm')
     and has_table_privilege('anon', c.oid, p.priv);
  if v_writes is not null then
    raise exception 'anon holds write privileges: %', v_writes;
  end if;

  raise notice 'ok: anon reads only the guest-page columns and writes nothing';
end$$;

-- The two functions guests call, run as anon.
insert into public.players (name, status, pin) values ('Lockdown Placeholder', 'placeholder', '');
insert into public.players (name, status) values ('Lockdown Member', 'active');
set local role anon;
do $$
begin
  if public.signup_name_match('Nobody') <> 'none' then
    raise exception 'a one-word name must not match';
  end if;
  if public.signup_name_match('Zz Nobody Zz') <> 'none' then
    raise exception 'an unknown name must not match';
  end if;
  if public.signup_name_match('  lockdown   PLACEHOLDER ') <> 'placeholder' then
    raise exception 'a placeholder''s name must match, whatever the spacing and case';
  end if;
  if public.signup_name_match('Lockdown Member') <> 'member' then
    raise exception 'a member''s name must match';
  end if;
  perform public.get_group_link();
  raise notice 'ok: anon can call signup_name_match and get_group_link';
end$$;
reset role;

rollback;
