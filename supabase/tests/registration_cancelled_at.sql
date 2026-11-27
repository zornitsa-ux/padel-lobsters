-- ============================================================================
-- When a spot was cancelled (20261127130000, docs/event-system/ PLAN EV6).
--
-- Invented players only. One transaction, rolled back, so now() is the same
-- instant throughout: a row cancelled here has cancelled_at = now(). Deferred
-- team checks are forced with SET CONSTRAINTS, since a rollback never reaches
-- commit.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < supabase/tests/registration_cancelled_at.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

create function pg_temp.act(input_player uuid, input_admin boolean) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', input_player, 'role', 'authenticated',
    'app_metadata', case when input_admin then json_build_object('role', 'admin') else '{}'::json end
  )::text, true);
end $$;

create function pg_temp.player(input_name text, input_role player_role default 'player') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.players(name, email, playtomic_level, gender, status, role)
  values (input_name, lower(replace(input_name, ' ', '.')) || '@example.test', 3, 'f', 'active', input_role)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.event(input_team boolean, input_max integer default 16) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.tournaments(name, date, time, duration, max_players, entry_mode, format)
  values ('Cancelled at test', (now() at time zone 'Europe/Amsterdam')::date + 7, '20:00', 90, input_max,
          case when input_team then 'team' else 'individual' end,
          case when input_team then 'king_of_court' else 'lobster_matching' end)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.team(input_tournament uuid, input_captain uuid, input_partner uuid) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.event_teams(tournament_id, captain_id, created_by)
  values (input_tournament, input_captain, input_captain)
  returning id into v_id;
  insert into public.registrations(tournament_id, player_id, status, payment_status, payment_method, team_id, accepted_at)
  values (input_tournament, input_captain, 'registered', 'unpaid', '', v_id, now()),
         (input_tournament, input_partner, 'registered', 'covered', '', v_id, null);
  return v_id;
end $$;

create function pg_temp.solo(input_tournament uuid, input_player uuid, input_status text default 'registered')
returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.registrations(tournament_id, player_id, status, payment_status, payment_method)
  values (input_tournament, input_player, input_status, 'unpaid', '')
  returning id into v_id;
  return v_id;
end $$;

-- A player's row in an event: the cancelled one, if they have one.
create function pg_temp.spot(input_tournament uuid, input_player uuid) returns public.registrations
language sql as $$
  select r.* from public.registrations r
   where r.tournament_id = input_tournament and r.player_id = input_player
   order by r.status = 'cancelled' desc, r.id
   limit 1;
$$;

create function pg_temp.cancelled_at(input_id uuid) returns timestamptz
language sql as $$
  select r.cancelled_at from public.registrations r where r.id = input_id;
$$;

create function pg_temp.stamped(input_tournament uuid, input_player uuid) returns boolean
language sql as $$
  select (s).status = 'cancelled' and (s).cancelled_at = now()
    from (select pg_temp.spot(input_tournament, input_player) as s) x;
$$;

create function pg_temp.check(input_ok boolean, input_label text) returns void
language plpgsql as $$
begin
  if input_ok is distinct from true then
    raise exception 'FAILED: %', input_label;
  end if;
end $$;

do $$
declare
  v_admin uuid := pg_temp.player('Ada Canceltest', 'admin');
  v_a uuid := pg_temp.player('Ana Canceltest');
  v_b uuid := pg_temp.player('Bo Canceltest');
  v_c uuid := pg_temp.player('Cy Canceltest');
  v_d uuid := pg_temp.player('Di Canceltest');
  v_e uuid := pg_temp.player('Ed Canceltest');
  v_f uuid := pg_temp.player('Flo Canceltest');
  v_g uuid := pg_temp.player('Gus Canceltest');
  v_h uuid := pg_temp.player('Hal Canceltest');
  v_i uuid := pg_temp.player('Ivy Canceltest');
  v_j uuid := pg_temp.player('Jo Canceltest');
  v_k uuid := pg_temp.player('Kai Canceltest');
  v_l uuid := pg_temp.player('Lu Canceltest');
  v_m uuid := pg_temp.player('Mo Canceltest');
  v_solo uuid := pg_temp.event(false);
  v_full uuid := pg_temp.event(false, 1);
  v_teams uuid := pg_temp.event(true);
  v_reg uuid;
  v_team uuid;
  v_xfer uuid;
  v_r record;
  v_old timestamptz := now() - interval '3 days';
begin
  -- 1. An admin cancels a spot (cancel_registration_row).
  v_reg := pg_temp.solo(v_solo, v_a);
  perform pg_temp.check((pg_temp.spot(v_solo, v_a)).cancelled_at is null, 'P1: an active spot has no time');
  perform pg_temp.act(v_admin, true);
  perform public.cancel_registration(v_reg);
  perform pg_temp.check(pg_temp.stamped(v_solo, v_a), 'P1: cancel_registration sets it');
  raise notice 'P1 ok: cancel_registration_row';

  -- 2. An admin cancels a team (cancel_team_rows): both rows.
  v_team := pg_temp.team(v_teams, v_b, v_c);
  set constraints all immediate;
  set constraints all deferred;
  perform public.admin_cancel_team(v_team);
  set constraints all immediate;
  set constraints all deferred;
  perform pg_temp.check(pg_temp.stamped(v_teams, v_b) and pg_temp.stamped(v_teams, v_c),
                        'P2: cancel_team_rows sets both');
  raise notice 'P2 ok: cancel_team_rows';

  -- 3. Transfers: an individual spot and a team spot (apply_registration_transfer,
  -- apply_team_transfer).
  perform pg_temp.solo(v_solo, v_d);
  select * into v_r from public.admin_transfer_registration(v_solo, v_d, v_e);
  perform pg_temp.check(v_r.status = 'accepted', 'P3: solo transfer, got ' || v_r.status);
  perform pg_temp.check(pg_temp.stamped(v_solo, v_d), 'P3: the giver''s spot is stamped');
  perform pg_temp.check((pg_temp.spot(v_solo, v_e)).cancelled_at is null, 'P3: the recipient''s spot is not');

  v_team := pg_temp.team(v_teams, v_f, v_g);
  update public.registrations r set accepted_at = now() where r.team_id = v_team and r.player_id = v_g;
  set constraints all immediate;
  set constraints all deferred;
  select * into v_r from public.admin_transfer_registration(v_teams, v_g, v_h);
  perform pg_temp.check(v_r.status = 'accepted', 'P3: team transfer, got ' || v_r.status);
  set constraints all immediate;
  set constraints all deferred;
  perform pg_temp.check(pg_temp.stamped(v_teams, v_g), 'P3: the team giver''s spot is stamped');
  raise notice 'P3 ok: apply_registration_transfer, apply_team_transfer';

  -- 4. A waitlisted player declines a transfer: their waitlist spot goes with
  -- it (respond_to_transfer).
  perform pg_temp.solo(v_full, v_i);
  perform pg_temp.solo(v_full, v_j, 'waitlist');
  perform pg_temp.act(v_i, false);
  select * into v_r from public.create_transfer(v_j, v_full);
  v_xfer := v_r.transfer_id;
  perform pg_temp.act(v_j, false);
  select * into v_r from public.respond_to_transfer(v_xfer, false);
  perform pg_temp.check(v_r.status = 'declined', 'P4: declined, got ' || v_r.status);
  perform pg_temp.check(pg_temp.stamped(v_full, v_j), 'P4: the recipient''s waitlist row is stamped');
  perform pg_temp.check((pg_temp.spot(v_full, v_i)).cancelled_at is null, 'P4: the giver keeps their spot');
  raise notice 'P4 ok: respond_to_transfer';

  -- 5. A captain changes partner (change_team_partner).
  v_team := pg_temp.team(v_teams, v_k, v_l);
  set constraints all immediate;
  set constraints all deferred;
  perform pg_temp.act(v_k, false);
  select * into v_r from public.change_team_partner(v_team, v_m);
  perform pg_temp.check(v_r.status = 'changed', 'P5: partner change, got ' || v_r.status);
  set constraints all immediate;
  set constraints all deferred;
  perform pg_temp.check(pg_temp.stamped(v_teams, v_l), 'P5: the old partner''s spot is stamped');
  raise notice 'P5 ok: change_team_partner';

  -- 6. Account deletion cancels upcoming spots through the paths above.
  perform set_config('request.jwt.claims', '', true);
  perform private.delete_account(v_e, true);
  perform pg_temp.check(pg_temp.stamped(v_solo, v_e), 'P6: deletion stamps the spot');
  raise notice 'P6 ok: delete_account';

  -- 7. Registering again: a new row. The old row keeps its time, and a later
  -- write to it can't move or clear it.
  set constraints all immediate;
  alter table public.registrations disable trigger registrations_stamp_cancelled;
  update public.registrations r set cancelled_at = v_old
   where r.id = v_reg;
  alter table public.registrations enable trigger registrations_stamp_cancelled;

  perform pg_temp.act(v_a, false);
  select * into v_r from public.register_for_tournament(v_solo, v_a);
  perform pg_temp.check(v_r.status = 'registered', 'R7: registers again, got ' || v_r.status);
  perform pg_temp.check(pg_temp.cancelled_at(v_r.registration_id) is null,
                        'R7: the new row has no time');
  perform pg_temp.check(pg_temp.cancelled_at(v_reg) = v_old, 'R7: the old row keeps its time');

  update public.registrations r set payment_method = 'changed', cancelled_at = null
   where r.id = v_reg;
  perform pg_temp.check(pg_temp.cancelled_at(v_reg) = v_old, 'R7: a later write keeps the time');
  raise notice 'R7 ok: registering again leaves the old row alone';

  -- 8. Only a cancelled row has a time.
  begin
    update public.registrations r set cancelled_at = now() where r.id = v_r.registration_id;
    perform pg_temp.check(pg_temp.cancelled_at(v_r.registration_id) is null,
                          'C8: an active row gets no time');
  end;
  begin
    alter table public.registrations disable trigger registrations_stamp_cancelled;
    update public.registrations r set cancelled_at = now() where r.id = v_r.registration_id;
    raise exception 'FAILED: C8: the check should refuse a time on an active row';
  exception when check_violation then
    null;
  end;
  raise notice 'C8 ok: only cancelled rows have a time';
end $$;

rollback;
