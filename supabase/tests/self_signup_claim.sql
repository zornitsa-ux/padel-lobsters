-- ============================================================================
-- self_signup_player checks: new signups and claiming an existing
-- placeholder profile (20261011150000).
--
-- Plain script, same as the other files here: every check raises on failure
-- and everything rolls back.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/self_signup_claim.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

do $$
declare
  v_ph       uuid;
  v_active   uuid;
  v_row      record;
  v_player   public.players%rowtype;
  v_ok       boolean;
  v_count    integer;
begin
  insert into public.players (name, status) values ('Test Placeholder', 'placeholder')
  returning id into v_ph;

  -- CHECK 1: brand-new signup creates an active row with a PIN; comma level parsed
  select * into v_row from public.self_signup_player(
    jsonb_build_object('name', 'Brand New', 'email', 'brand.new@test.invalid',
                       'playtomic_level', '2,2'));
  select * into v_player from public.players where id = v_row.player_id;
  if v_row.was_existing or v_row.pin is null or v_player.status <> 'active'
     or v_player.playtomic_level <> 2.2 then
    raise exception 'CHECK 1 FAILED: new signup row %', row_to_json(v_player);
  end if;
  raise notice 'CHECK 1 ok: new signup';

  -- CHECK 2: wrong name cannot claim the placeholder
  v_ok := false;
  begin
    perform public.self_signup_player(
      jsonb_build_object('name', 'Someone Else', 'email', 'else@test.invalid'),
      null, null, v_ph);
  exception when others then
    v_ok := sqlerrm like '%placeholder not claimable%';
  end;
  if not v_ok then raise exception 'CHECK 2 FAILED: name mismatch claimed the placeholder'; end if;
  raise notice 'CHECK 2 ok: name mismatch refused';

  -- CHECK 3: matching name claims the same row (case-insensitive), becomes active
  select * into v_row from public.self_signup_player(
    jsonb_build_object('name', 'test placeholder', 'email', 'claimer@test.invalid',
                       'phone', '+31600000000', 'playtomic_level', '1.5'),
    null, null, v_ph);
  select * into v_player from public.players where id = v_ph;
  if v_row.player_id <> v_ph or v_row.pin is null or v_player.status <> 'active'
     or v_player.email <> 'claimer@test.invalid' or v_player.pin <> v_row.pin then
    raise exception 'CHECK 3 FAILED: claim result % row %', row_to_json(v_row), row_to_json(v_player);
  end if;
  select count(*) into v_count from public.players where lower(name) = 'test placeholder';
  if v_count <> 1 then raise exception 'CHECK 3 FAILED: % rows for claimed name', v_count; end if;
  raise notice 'CHECK 3 ok: placeholder claimed in place';

  -- CHECK 4: an active profile can never be claimed this way
  v_active := v_ph;
  v_ok := false;
  begin
    perform public.self_signup_player(
      jsonb_build_object('name', 'Test Placeholder', 'email', 'hijack@test.invalid'),
      null, null, v_active);
  exception when others then
    v_ok := sqlerrm like '%placeholder not claimable%';
  end;
  if not v_ok then raise exception 'CHECK 4 FAILED: active profile was claimable'; end if;
  raise notice 'CHECK 4 ok: active profile refused';

  -- CHECK 5: an email already on an active row returns was_existing and no PIN
  select * into v_row from public.self_signup_player(
    jsonb_build_object('name', 'Dup Email', 'email', 'claimer@test.invalid'));
  if not v_row.was_existing or v_row.pin is not null then
    raise exception 'CHECK 5 FAILED: duplicate email result %', row_to_json(v_row);
  end if;
  raise notice 'CHECK 5 ok: duplicate email';

  -- CHECK 6: grants — anon can call the new signature, the old one is gone
  if not has_function_privilege('anon', 'public.self_signup_player(jsonb,text,text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.self_signup_player(jsonb,text,text,uuid)', 'execute') then
    raise exception 'CHECK 6 FAILED: unexpected grants on self_signup_player';
  end if;
  if to_regprocedure('public.self_signup_player(jsonb,text,text)') is not null then
    raise exception 'CHECK 6 FAILED: old 3-arg self_signup_player still exists';
  end if;
  raise notice 'CHECK 6 ok: grants';
end;
$$;

rollback;
