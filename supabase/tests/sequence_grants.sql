-- ============================================================================
-- Sequence grants: a role that may insert into a public table must be able to
-- use every sequence behind that table's columns (serial, identity, or a
-- nextval default), or each insert fails with "permission denied for
-- sequence" (#99).
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
  with table_seqs as materialized (
    -- Owned by a column (serial, identity).
    select d.refobjid as table_oid, d.objid as seq_oid
      from pg_depend d
     where d.classid = 'pg_class'::regclass
       and d.refclassid = 'pg_class'::regclass
       and d.deptype in ('a', 'i')
    union
    -- Called from a column default.
    select ad.adrelid, d.refobjid
      from pg_attrdef ad
      join pg_depend d on d.classid = 'pg_attrdef'::regclass and d.objid = ad.oid
                      and d.refclassid = 'pg_class'::regclass
  ), seqs as materialized (
    select ts.table_oid, s.oid as seq_oid, s.relname as seq_name
      from table_seqs ts
      join pg_class s on s.oid = ts.seq_oid and s.relkind = 'S'
      join pg_class t on t.oid = ts.table_oid and t.relnamespace = 'public'::regnamespace
  )
  select string_agg(format('%s on %s (%s)', r.role, t.relname, seqs.seq_name), ', '
                    order by r.role, t.relname)
    into v_missing
    from seqs
    join pg_class t on t.oid = seqs.table_oid
    cross join (values ('anon'), ('authenticated')) as r(role)
   where has_any_column_privilege(r.role, t.oid, 'INSERT')
     and not has_sequence_privilege(r.role, seqs.seq_oid, 'USAGE');

  if v_missing is not null then
    raise exception 'can insert but not use the sequence: %', v_missing;
  end if;
  raise notice 'ok: every insertable table''s sequences are usable by anon and authenticated';
end$$;
