-- ============================================================================
-- self_signup_player checks: new signups, placeholder names, email
-- conflicts, and PIN uniqueness (20261012120000).
--
-- Plain script like the other files here: every check raises on failure and
-- the transaction rolls back, leaving no fixtures behind.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/self_signup.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

do $$
declare
  v_ph       uuid;
  v_hashonly uuid;
  v_row      record;
  v_login    record;
  v_player   public.players%rowtype;
  v_pin      text;
  v_err      text;
  v_count    integer;
begin
  insert into public.players (name, status, pin) values ('Test  Placeholder', 'placeholder', '')
  returning id into v_ph;

  -- CHECK 1: new signup is active, logs in with its PIN, and parses a comma level
  select * into v_row from public.self_signup_player(
    jsonb_build_object('name', 'Brand New', 'email', 'Brand.New@test.invalid',
                       'playtomic_level', '2,2'));
  select * into v_player from public.players where id = v_row.player_id;
  select * into v_login from public.verify_player_pin_v2(v_row.pin, 'test-device-1');
  if v_row.was_existing or v_player.status <> 'active' or v_player.playtomic_level <> 2.2
     or v_player.email <> 'brand.new@test.invalid'
     or v_login.status <> 'ok' or v_login.player_id <> v_row.player_id then
    raise exception 'CHECK 1 FAILED: row % login %', row_to_json(v_player), row_to_json(v_login);
  end if;
  raise notice 'CHECK 1 ok: new signup';

  -- CHECK 2: a placeholder's name (case/whitespace-insensitive) is refused
  -- and the placeholder is left untouched for the admin invite
  v_err := null;
  begin
    perform public.self_signup_player(
      jsonb_build_object('name', ' test placeholder ', 'email', 'claimer@test.invalid'));
  exception when others then v_err := sqlerrm;
  end;
  select * into v_player from public.players where id = v_ph;
  if v_err is distinct from 'placeholder needs invite' or v_player.status <> 'placeholder'
     or v_player.email is not null then
    raise exception 'CHECK 2 FAILED: got % row %', v_err, row_to_json(v_player);
  end if;
  select count(*) into v_count from public.players where email = 'claimer@test.invalid';
  if v_count <> 0 then raise exception 'CHECK 2 FAILED: a row was created'; end if;
  raise notice 'CHECK 2 ok: placeholder name refused';

  -- CHECK 3: once an admin has activated the placeholder, the same name is
  -- no longer blocked (it is an ordinary active player)
  update public.players set status = 'active', email = 'claimer@test.invalid' where id = v_ph;
  select * into v_row from public.self_signup_player(
    jsonb_build_object('name', 'Test Placeholder', 'email', 'namesake@test.invalid'));
  if v_row.was_existing or v_row.player_id is null or v_row.player_id = v_ph then
    raise exception 'CHECK 3 FAILED: %', row_to_json(v_row);
  end if;
  raise notice 'CHECK 3 ok: active namesake can sign up';

  -- CHECK 5: an email on an active row returns was_existing and no PIN
  select * into v_row from public.self_signup_player(
    jsonb_build_object('name', 'Dup Email', 'email', 'CLAIMER@test.invalid'));
  if not v_row.was_existing or v_row.pin is not null then
    raise exception 'CHECK 4 FAILED: %', row_to_json(v_row);
  end if;
  raise notice 'CHECK 4 ok: active email';

  -- CHECK 6: an email held by a non-active row or only by auth.users is a
  -- clear error, not a unique violation
  insert into public.players (name, status, email) values ('Old Inactive', 'inactive', 'old@test.invalid');
  v_err := null;
  begin
    perform public.self_signup_player(jsonb_build_object('name', 'Old Again', 'email', 'old@test.invalid'));
  exception when others then v_err := sqlerrm;
  end;
  if v_err is distinct from 'email in use' then raise exception 'CHECK 5 FAILED (player): got %', v_err; end if;

  update auth.users set email = 'orphan@test.invalid'
   where id = (select id from public.players where email = 'old@test.invalid');
  update public.players set email = null where email = 'old@test.invalid';
  v_err := null;
  begin
    perform public.self_signup_player(jsonb_build_object('name', 'Orphan', 'email', 'orphan@test.invalid'));
  exception when others then v_err := sqlerrm;
  end;
  if v_err is distinct from 'email in use' then raise exception 'CHECK 5 FAILED (auth): got %', v_err; end if;
  raise notice 'CHECK 5 ok: non-active email conflicts';

  -- CHECK 7: a PIN held only as a hash is never reissued. setseed makes the
  -- first candidate predictable; give it to a hash-only player and re-roll.
  perform setseed(0.42);
  v_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
  delete from public.players where pin = v_pin;
  insert into public.players (name, status, pin) values ('Hash Only', 'active', v_pin)
  returning id into v_hashonly;
  update public.players set pin = null where id = v_hashonly;
  perform setseed(0.42);
  if private.generate_unique_pin() = v_pin then
    raise exception 'CHECK 6 FAILED: reissued hash-only PIN %', v_pin;
  end if;
  raise notice 'CHECK 6 ok: hash-only PIN not reissued';

  -- CHECK 8: invalid level is rejected
  v_err := null;
  begin
    perform public.self_signup_player(
      jsonb_build_object('name', 'Bad Level', 'email', 'bad@test.invalid', 'playtomic_level', 'abc'));
  exception when others then v_err := sqlerrm;
  end;
  if v_err is distinct from 'invalid level' then raise exception 'CHECK 7 FAILED: got %', v_err; end if;
  raise notice 'CHECK 7 ok: invalid level';

  -- CHECK 9: grants — anon only on self_signup_player; helper private
  if not has_function_privilege('anon', 'public.self_signup_player(jsonb,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.self_signup_player(jsonb,text,text)', 'execute')
     or has_function_privilege('anon', 'private.generate_unique_pin()', 'execute')
     or has_function_privilege('authenticated', 'private.generate_unique_pin()', 'execute') then
    raise exception 'CHECK 8 FAILED: unexpected grants';
  end if;
  raise notice 'CHECK 8 ok: grants';
end;
$$;

rollback;
