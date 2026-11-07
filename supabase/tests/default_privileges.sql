-- ============================================================================
-- A table or sequence created by a later migration gets no anon or
-- authenticated privileges until that migration grants them (#102). Production
-- carried Supabase's older defaults, which granted everything.
--
--   npm run db:test
-- ============================================================================

begin;

create table public.zz_default_privileges_probe (id serial primary key);

do $$
declare
  v_granted text;
begin
  select string_agg(r.role || ':' || p.priv, ', ') into v_granted
    from (values ('anon'), ('authenticated')) r(role)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
   where has_table_privilege(r.role, 'public.zz_default_privileges_probe', p.priv);
  if v_granted is not null then
    raise exception 'a new table is open to browser roles by default: %', v_granted;
  end if;

  if has_sequence_privilege('anon', 'public.zz_default_privileges_probe_id_seq', 'USAGE')
     or has_sequence_privilege('authenticated', 'public.zz_default_privileges_probe_id_seq', 'USAGE') then
    raise exception 'a new sequence is usable by browser roles by default';
  end if;

  raise notice 'ok: new tables and sequences start closed to anon and authenticated';
end$$;

rollback;
