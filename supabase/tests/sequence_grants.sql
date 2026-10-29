-- ============================================================================
-- Sequence grants: a public table that authenticated may insert into must let
-- authenticated use the sequence behind its serial/identity columns, or every
-- insert fails with "permission denied for sequence" (#99).
--
-- Run against a local stack:
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/sequence_grants.sql
-- ============================================================================

do $$
declare
  v_missing text;
begin
  with seqs as materialized (
    select s.oid, s.relname, d.refobjid as table_oid
      from pg_class s
      join pg_depend d on d.classid = 'pg_class'::regclass and d.objid = s.oid
                      and d.refclassid = 'pg_class'::regclass and d.deptype in ('a', 'i')
     where s.relkind = 'S'
       and s.relnamespace = 'public'::regnamespace
  )
  select string_agg(format('%s (%s)', t.relname, seqs.relname), ', ' order by t.relname)
    into v_missing
    from seqs
    join pg_class t on t.oid = seqs.table_oid
   where has_table_privilege('authenticated', t.oid, 'INSERT')
     and not has_sequence_privilege('authenticated', seqs.oid, 'USAGE');

  if v_missing is not null then
    raise exception 'authenticated can insert but not use the sequence: %', v_missing;
  end if;
  raise notice 'ok: every insertable table''s sequence is usable by authenticated';
end$$;
