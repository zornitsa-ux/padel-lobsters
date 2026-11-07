-- ============================================================================
-- Objects a later migration creates start closed to browser roles (#102).
--
-- The local image already has these defaults, so this can't prove production
-- has them: `npm run db:grants:prod` after each push does that. It guards
-- against a migration re-opening the defaults, and checks that the per-function
-- `revoke execute ... from public` pattern really closes a function.
--
--   npm run db:test
-- ============================================================================

begin;

do $$
declare
  v_open text;
begin
  select string_agg(d.defaclobjtype::text || ':' || a.grantee::regrole::text || ':' || a.privilege_type, ', ')
    into v_open
    from pg_default_acl d
    cross join aclexplode(d.defaclacl) a
   where d.defaclrole = 'postgres'::regrole
     and d.defaclnamespace = 'public'::regnamespace
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole);
  if v_open is not null then
    raise exception 'postgres default privileges open new objects to browser roles: %', v_open;
  end if;
end$$;

create table public.zz_default_privileges_probe (id serial primary key);
create function public.zz_default_privileges_probe_fn() returns int language sql as 'select 1';
revoke execute on function public.zz_default_privileges_probe_fn() from public;

do $$
begin
  if has_table_privilege('anon', 'public.zz_default_privileges_probe', 'SELECT')
     or has_table_privilege('authenticated', 'public.zz_default_privileges_probe', 'SELECT')
     or has_sequence_privilege('anon', 'public.zz_default_privileges_probe_id_seq', 'USAGE') then
    raise exception 'a new table or sequence is open to browser roles by default';
  end if;
  if has_function_privilege('anon', 'public.zz_default_privileges_probe_fn()', 'EXECUTE') then
    raise exception 'revoke from public does not close a new function to anon';
  end if;
  raise notice 'ok: new tables, sequences and closed functions are shut to browser roles';
end$$;

rollback;
