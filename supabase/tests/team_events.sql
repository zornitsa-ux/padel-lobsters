-- ============================================================================
-- Team events (20261022120000, docs/team-events/CONTRACTS.md).
--
-- Every case in PLAN §2 T1, plus the database-enforced invariants. Runs inside
-- one transaction that rolls back. Deferred team-consistency checks are forced
-- with SET CONSTRAINTS after each step, because a rollback never reaches the
-- commit where they would otherwise fire.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < supabase/tests/team_events.sql
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

-- Fires pending deferred checks now, then asserts the pair rule directly too.
create function pg_temp.assert_teams(input_tournament uuid) returns void
language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
  if exists (
    select 1 from public.event_teams et
      left join public.registrations r on r.team_id = et.id and r.status in ('registered', 'waitlist')
     where et.tournament_id = input_tournament
     group by et.id
    having count(r.id) not in (0, 2) or count(distinct r.status) > 1
  ) then
    raise exception 'team pair diverged in %', input_tournament;
  end if;
end $$;

create function pg_temp.event(input_max integer, input_starts timestamptz) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.tournaments(name, date, time, max_players, entry_mode, format, status)
  values ('Team test', (input_starts at time zone 'Europe/Amsterdam')::date,
          to_char(input_starts at time zone 'Europe/Amsterdam', 'HH24:MI'),
          input_max, 'team', 'king_of_court', 'upcoming')
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  v_admin uuid;
  v_p uuid[];
  v_placeholder uuid;
  v_t uuid;
  v_t_soon uuid;
  v_t_ind uuid;
  v_r record;
  v_team1 uuid;
  v_team2 uuid;
  v_team3 uuid;
  v_new uuid;
  v_queue_before bigint;
  v_count integer;
begin
  select id into v_admin from public.players where role = 'admin' and status = 'active' order by id limit 1;
  select array_agg(id order by id) into v_p
    from (select id from public.players where role = 'player' and status = 'active' order by id limit 14) s;
  select id into v_placeholder from public.players where status = 'placeholder' order by id limit 1;
  if array_length(v_p, 1) < 14 or v_admin is null or v_placeholder is null then
    raise exception 'seed data missing';
  end if;

  v_t := pg_temp.event(4, now() + interval '10 days');
  v_queue_before := (select count(*) from net.http_request_queue);

  -- CHECK 1: a team fills two spots; with fewer than two free the team waits whole
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[1], v_p[2]);
  if v_r.status <> 'registered' then raise exception 'CHECK 1a FAILED: %', v_r.status; end if;
  v_team1 := v_r.team_id;
  if (select payment_status from public.registrations where team_id = v_team1 and player_id = v_p[2]) <> 'covered'
     or (select payment_status from public.registrations where team_id = v_team1 and player_id = v_p[1]) <> 'unpaid' then
    raise exception 'CHECK 1b FAILED: payment statuses';
  end if;
  perform pg_temp.act(v_p[3], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[3], v_p[4]);
  v_team2 := v_r.team_id;
  perform pg_temp.act(v_p[5], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[5], v_p[6]);
  if v_r.status <> 'waitlist'
     or (select count(*) from public.registrations where team_id = v_r.team_id and status = 'waitlist') <> 2 then
    raise exception 'CHECK 1c FAILED: %', v_r.status;
  end if;
  v_team3 := v_r.team_id;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 1 ok: registered, then waitlisted whole';

  -- CHECK 2: a captain or partner already in the event is rejected
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[1], v_p[7]);
  if v_r.status <> 'already_registered' or v_r.team_id <> v_team1 or v_r.partner_id <> v_p[2] then
    raise exception 'CHECK 2a FAILED: %', v_r.status;
  end if;
  perform pg_temp.act(v_p[7], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[7], v_p[6]);
  if v_r.status <> 'partner_already_entered' then raise exception 'CHECK 2b FAILED: %', v_r.status; end if;
  select * into v_r from public.register_team_for_tournament(v_t, v_p[7], v_p[7]);
  if v_r.status <> 'invalid_partner' then raise exception 'CHECK 2c FAILED: %', v_r.status; end if;
  select * into v_r from public.register_team_for_tournament(v_t, v_p[7]);
  if v_r.status <> 'invalid_partner' then raise exception 'CHECK 2d FAILED: %', v_r.status; end if;
  raise notice 'CHECK 2 ok: already entered / invalid partner';

  -- CHECK 3: a placeholder is rejected as partner
  select * into v_r from public.register_team_for_tournament(v_t, v_p[7], v_placeholder);
  if v_r.status <> 'partner_not_active' then raise exception 'CHECK 3 FAILED: %', v_r.status; end if;
  raise notice 'CHECK 3 ok: placeholder rejected';

  -- CHECK 4: a new partner needs consent
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[7], null, '{"name": "New One", "email": "te-new1@test.invalid"}'::jsonb);
  if v_r.status <> 'consent_required'
     or exists (select 1 from public.players where email = 'te-new1@test.invalid') then
    raise exception 'CHECK 4 FAILED: %', v_r.status;
  end if;
  raise notice 'CHECK 4 ok: consent required';

  -- CHECK 5: a new partner is an active member with a confirmed auth user, an
  -- email identity, a partner_invites row with consent, and nothing is mailed
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[7], null, '{"name": "  New   One ", "email": "TE-New1@test.invalid", "playtomic_level": "3.5"}'::jsonb, true);
  if v_r.status <> 'waitlist' then raise exception 'CHECK 5a FAILED: %', v_r.status; end if;
  v_new := v_r.partner_id;
  if not exists (select 1 from public.players where id = v_new and status = 'active' and name = 'New One'
                   and email = 'te-new1@test.invalid' and playtomic_level = 3.5 and mm_rating is null) then
    raise exception 'CHECK 5b FAILED: player row';
  end if;
  if not exists (select 1 from auth.users where id = v_new and email = 'te-new1@test.invalid' and email_confirmed_at is not null) then
    raise exception 'CHECK 5c FAILED: auth user';
  end if;
  if not exists (select 1 from auth.identities where user_id = v_new and provider = 'email'
                   and identity_data ->> 'email' = 'te-new1@test.invalid') then
    raise exception 'CHECK 5d FAILED: identity';
  end if;
  if not exists (select 1 from public.partner_invites where player_id = v_new and tournament_id = v_t
                   and requested_by = v_p[7] and consent_confirmed_at is not null and invited_at is null) then
    raise exception 'CHECK 5e FAILED: partner_invites';
  end if;
  if (select count(*) from net.http_request_queue) <> v_queue_before then
    raise exception 'CHECK 5f FAILED: an email was queued';
  end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 5 ok: new partner active, signed-in-able, unmailed';

  -- CHECK 6: email_in_use against players and auth.users; bad input rejected
  perform pg_temp.act(v_p[8], false);
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[8], null, '{"name": "Dup", "email": "te-new1@TEST.invalid"}'::jsonb, true);
  if v_r.status <> 'email_in_use' then raise exception 'CHECK 6a FAILED: %', v_r.status; end if;
  insert into auth.users(id, instance_id, aud, role, email)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'te-authonly@test.invalid');
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[8], null, '{"name": "Dup", "email": "te-authonly@test.invalid"}'::jsonb, true);
  if v_r.status <> 'email_in_use' then raise exception 'CHECK 6b FAILED: %', v_r.status; end if;
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[8], null, '{"name": "Dup", "email": "nope"}'::jsonb, true);
  if v_r.status <> 'invalid_email' then raise exception 'CHECK 6c FAILED: %', v_r.status; end if;
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[8], null, '{"name": "Dup", "email": "x@padelobsters.internal"}'::jsonb, true);
  if v_r.status <> 'invalid_email' then raise exception 'CHECK 6d FAILED: %', v_r.status; end if;
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[8], null, '{"name": "   ", "email": "te-x@test.invalid"}'::jsonb, true);
  if v_r.status <> 'invalid_name' then raise exception 'CHECK 6e FAILED: %', v_r.status; end if;
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[8], null, '{"name": "Lv", "email": "te-x@test.invalid", "playtomic_level": "9"}'::jsonb, true);
  if v_r.status <> 'invalid_level' then raise exception 'CHECK 6f FAILED: %', v_r.status; end if;
  raise notice 'CHECK 6 ok: email_in_use (players, auth.users) and input validation';

  -- CHECK 7: at most 3 new partners per person per day; admins exempt
  -- v_p[7] already created one in CHECK 5.
  for i in 1..3 loop
    perform pg_temp.act(v_p[7], false);
    v_t_ind := pg_temp.event(4, now() + interval '10 days');
    select * into v_r from public.register_team_for_tournament(
      v_t_ind, v_p[7], null, json_build_object('name', 'Cap ' || i, 'email', 'te-cap' || i || '@test.invalid')::jsonb, true);
    if i < 3 and v_r.status <> 'registered' then raise exception 'CHECK 7a FAILED (%): %', i, v_r.status; end if;
    if i = 3 and v_r.status <> 'partner_cap_reached' then raise exception 'CHECK 7b FAILED: %', v_r.status; end if;
  end loop;
  if exists (select 1 from public.players where email = 'te-cap3@test.invalid') then
    raise exception 'CHECK 7c FAILED: capped call created a player';
  end if;
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.register_team_for_tournament(
    v_t_ind, v_p[7], null, '{"name": "Cap 3", "email": "te-cap3@test.invalid"}'::jsonb, true);
  if v_r.status <> 'registered'
     or (select requested_by from public.partner_invites where player_id = v_r.partner_id) <> v_admin then
    raise exception 'CHECK 7d FAILED: %', v_r.status;
  end if;
  raise notice 'CHECK 7 ok: daily cap, admin exempt and recorded as requested_by';

  -- CHECK 8: a non-admin can't register a team for someone else
  perform pg_temp.act(v_p[9], false);
  begin
    perform public.register_team_for_tournament(v_t, v_p[10], v_p[11]);
    raise exception 'CHECK 8 FAILED: no error';
  exception when others then
    if sqlerrm not like 'unauthorized%' then raise; end if;
  end;
  raise notice 'CHECK 8 ok: captain must be the caller unless admin';

  -- CHECK 9: cancelling a registered team promotes the oldest waitlisted team
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.admin_cancel_team(v_team2);
  if v_r.status <> 'cancelled' or v_r.promoted_team_id <> v_team3
     or (select cancelled_reason from public.event_teams where id = v_team2) <> 'admin_cancelled' then
    raise exception 'CHECK 9a FAILED: % %', v_r.status, v_r.promoted_team_id;
  end if;
  if (select count(*) from public.registrations where team_id = v_team3 and status = 'registered') <> 2
     or (select count(*) from public.registrations where team_id = v_team2 and status = 'cancelled') <> 2 then
    raise exception 'CHECK 9b FAILED: rows';
  end if;
  select * into v_r from public.admin_cancel_team(v_team2);
  if v_r.status <> 'already_cancelled' then raise exception 'CHECK 9c FAILED: %', v_r.status; end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 9 ok: cancel promotes oldest waitlisted team whole';

  -- CHECK 10: admin_promote_team respects capacity
  select team_id into v_team2 from public.registrations
   where tournament_id = v_t and player_id = v_p[7] and status = 'waitlist';
  select * into v_r from public.admin_promote_team(v_team2);
  if v_r.status <> 'tournament_full' then raise exception 'CHECK 10a FAILED: %', v_r.status; end if;
  update public.tournaments set max_players = 6 where id = v_t;
  select * into v_r from public.admin_promote_team(v_team2);
  if v_r.status <> 'promoted' then raise exception 'CHECK 10b FAILED: %', v_r.status; end if;
  select * into v_r from public.admin_promote_team(v_team2);
  if v_r.status <> 'already_registered' then raise exception 'CHECK 10c FAILED: %', v_r.status; end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 10 ok: promote team';

  -- CHECK 11: change partner before the cutoff, by the captain
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.change_team_partner(v_team1, v_p[2]);
  if v_r.status <> 'same_partner' then raise exception 'CHECK 11a FAILED: %', v_r.status; end if;
  select * into v_r from public.change_team_partner(v_team1, v_p[12]);
  if v_r.status <> 'changed' or v_r.partner_id <> v_p[12] then raise exception 'CHECK 11b FAILED: %', v_r.status; end if;
  if (select status from public.registrations where team_id = v_team1 and player_id = v_p[2] order by created_at desc limit 1) <> 'cancelled'
     or (select payment_status from public.registrations where team_id = v_team1 and player_id = v_p[12] and status = 'registered') <> 'covered' then
    raise exception 'CHECK 11c FAILED: rows';
  end if;
  perform pg_temp.act(v_p[12], false);
  begin
    perform public.change_team_partner(v_team1, v_p[13]);
    raise exception 'CHECK 11d FAILED: partner could change';
  exception when others then
    if sqlerrm not like 'unauthorized%' then raise; end if;
  end;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 11 ok: captain changes partner before cutoff';

  -- CHECK 12: after the cutoff only an admin can change partner, including to a new one
  v_t_soon := pg_temp.event(4, now() + interval '3 hours');
  perform pg_temp.act(v_p[13], false);
  select * into v_r from public.register_team_for_tournament(v_t_soon, v_p[13], v_p[14]);
  v_team1 := v_r.team_id;
  select * into v_r from public.change_team_partner(v_team1, v_p[2]);
  if v_r.status <> 'change_closed' then raise exception 'CHECK 12a FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.change_team_partner(v_team1, null, '{"name": "Late", "email": "te-late@test.invalid"}'::jsonb);
  if v_r.status <> 'consent_required' then raise exception 'CHECK 12b FAILED: %', v_r.status; end if;
  select * into v_r from public.change_team_partner(v_team1, null, '{"name": "Late", "email": "te-late@test.invalid"}'::jsonb, true);
  if v_r.status <> 'changed'
     or not exists (select 1 from public.partner_invites where player_id = v_r.partner_id and tournament_id = v_t_soon) then
    raise exception 'CHECK 12c FAILED: %', v_r.status;
  end if;
  perform pg_temp.assert_teams(v_t_soon);
  raise notice 'CHECK 12 ok: cutoff, admin bypass, new partner on change';

  -- CHECK 13: the individual RPCs reject team events
  perform pg_temp.act(v_p[9], false);
  select * into v_r from public.register_for_tournament(v_t, v_p[9]);
  if v_r.status <> 'team_event' then raise exception 'CHECK 13a FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_p[5], false);
  select * into v_r from public.create_transfer(v_p[9], v_t);
  if v_r.status <> 'team_not_confirmed' then raise exception 'CHECK 13b FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_admin, true);
  select r.id into v_new from public.registrations r where r.tournament_id = v_t and r.player_id = v_p[5] and r.status = 'registered';
  select * into v_r from public.cancel_registration(v_new);
  if v_r.status <> 'use_cancel_team' then raise exception 'CHECK 13c FAILED: %', v_r.status; end if;
  select * into v_r from public.promote_waitlist_registration(v_new);
  if v_r.status <> 'use_promote_team' then raise exception 'CHECK 13d FAILED: %', v_r.status; end if;
  select * into v_r from public.admin_transfer_registration(v_t, v_p[5], v_p[9]);
  if v_r.status <> 'team_not_confirmed' then raise exception 'CHECK 13e FAILED: %', v_r.status; end if;
  -- a transfer created before the guard existed is refused on accept too
  insert into public.registration_transfers(tournament_id, from_player_id, to_player_id)
  values (v_t, v_p[5], v_p[9]);
  perform pg_temp.act(v_p[9], false);
  select * into v_r from public.respond_to_transfer(
    (select id from public.registration_transfers where tournament_id = v_t and status = 'pending'), true);
  if v_r.status <> 'team_not_confirmed' then raise exception 'CHECK 13f FAILED: %', v_r.status; end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 13 ok: register / cancel / promote guards; no transfer before both accept';

  -- CHECK 14: clients can't write registrations at all (D-016)
  perform pg_temp.act(v_p[5], false);
  execute 'set local role authenticated';
  begin
    update public.registrations set payment_status = 'paid' where id = v_new;
    raise exception 'CHECK 14a FAILED: direct update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.registrations(tournament_id, player_id, status) values (v_t, v_p[5], 'waitlist');
    raise exception 'CHECK 14b FAILED: direct insert allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  raise notice 'CHECK 14 ok: direct writes refused';

  -- CHECK 15: the pair can't diverge even through a privileged write
  begin
    update public.registrations set status = 'cancelled' where id = v_new;
    set constraints all immediate;
    raise exception 'CHECK 15a FAILED: divergence not caught';
  exception when others then
    if sqlerrm <> 'team_inconsistent' then raise; end if;
  end;
  set constraints all deferred;
  begin
    update public.registrations set team_id = null where id = v_new;
    raise exception 'CHECK 15b FAILED: teamless active row allowed';
  exception when others then
    if sqlerrm <> 'team_required' then raise; end if;
  end;
  raise notice 'CHECK 15 ok: pair invariant enforced by the database';

  -- CHECK 16: entry mode locks once anyone is entered; team capacity is even;
  -- team_id is refused on individual events
  begin
    update public.tournaments set entry_mode = 'individual', format = 'lobster_matching' where id = v_t;
    raise exception 'CHECK 16a FAILED';
  exception when others then
    if sqlerrm <> 'entry_mode_locked' then raise; end if;
  end;
  begin
    update public.tournaments set max_players = 7 where id = v_t;
    raise exception 'CHECK 16b FAILED';
  exception when check_violation then null;
  end;
  insert into public.tournaments(name, max_players) values ('Individual test', 8) returning id into v_t_ind;
  begin
    insert into public.registrations(tournament_id, player_id, status, team_id) values (v_t_ind, v_p[9], 'registered', v_team1);
    raise exception 'CHECK 16c FAILED';
  exception when others then
    if sqlerrm <> 'team_not_allowed' then raise; end if;
  end;
  perform pg_temp.act(v_p[9], false);
  select * into v_r from public.register_team_for_tournament(v_t_ind, v_p[9], v_p[10]);
  if v_r.status <> 'not_team_event' then raise exception 'CHECK 16d FAILED: %', v_r.status; end if;
  raise notice 'CHECK 16 ok: entry mode lock, even capacity, team_not_allowed, not_team_event';

  -- CHECK 17: partner_invites and the invite list are admin-only
  perform pg_temp.act(v_p[7], false);
  execute 'set local role authenticated';
  select count(*) into v_count from public.partner_invites;
  execute 'reset role';
  if v_count <> 0 then raise exception 'CHECK 17a FAILED: % rows visible', v_count; end if;
  execute 'set local role anon';
  begin
    perform 1 from public.partner_invites;
    raise exception 'CHECK 17b FAILED';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  begin
    perform public.admin_list_partner_invites(null);
    raise exception 'CHECK 17c FAILED';
  exception when others then
    if sqlerrm not like 'unauthorized%' then raise; end if;
  end;
  perform pg_temp.act(v_admin, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.partner_invites;
  execute 'reset role';
  if v_count < 4 then raise exception 'CHECK 17d FAILED: admin sees %', v_count; end if;
  if (select count(*) from public.admin_list_partner_invites(v_t) where last_sign_in_at is null) <> 1 then
    raise exception 'CHECK 17e FAILED';
  end if;
  raise notice 'CHECK 17 ok: partner_invites admin-only';

  -- CHECK 18: event_teams: everyone reads, only admins edit seed/final_rank, nobody inserts
  perform pg_temp.act(v_p[9], false);
  execute 'set local role authenticated';
  select count(*) into v_count from public.event_teams where tournament_id = v_t;
  update public.event_teams set seed = 1 where tournament_id = v_t;
  execute 'reset role';
  if v_count = 0 or exists (select 1 from public.event_teams where tournament_id = v_t and seed is not null) then
    raise exception 'CHECK 18a FAILED';
  end if;
  perform pg_temp.act(v_admin, true);
  execute 'set local role authenticated';
  update public.event_teams set seed = 1, final_rank = 2 where id = v_team3;
  begin
    update public.event_teams set captain_id = v_p[9] where id = v_team3;
    raise exception 'CHECK 18b FAILED';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.event_teams(tournament_id, captain_id) values (v_t, v_p[9]);
    raise exception 'CHECK 18c FAILED';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  if (select seed from public.event_teams where id = v_team3) <> 1 then raise exception 'CHECK 18d FAILED'; end if;
  raise notice 'CHECK 18 ok: event_teams access';

  -- CHECK 19: grants on the private helpers
  if has_function_privilege('authenticated', 'private.create_partner_player(uuid, uuid, jsonb, boolean, boolean)', 'execute')
     or has_function_privilege('authenticated', 'private.resolve_team_partner(uuid, uuid, uuid, jsonb, boolean)', 'execute')
     or has_function_privilege('authenticated', 'private.cancel_team_rows(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'private.team_spot_transferable(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.respond_to_team_invite(uuid, boolean)', 'execute')
     or has_function_privilege('anon', 'public.set_registration_payment(uuid, text, text)', 'execute')
     or has_function_privilege('anon', 'public.register_team_for_tournament(uuid, uuid, uuid, jsonb, boolean)', 'execute') then
    raise exception 'CHECK 19 FAILED';
  end if;
  raise notice 'CHECK 19 ok: grants';

  if (select count(*) from net.http_request_queue) <> v_queue_before then
    raise exception 'FINAL FAILED: an email was queued during team flows';
  end if;
  raise notice 'ALL TEAM EVENT CHECKS PASSED';
end $$;

-- ── D-015 acceptance model and D-016 payment writes ────────────────────────
do $$
declare
  v_admin uuid;
  v_p uuid[];
  v_outsider uuid;
  v_t uuid;
  v_r record;
  v_a uuid; v_b uuid; v_c uuid;
  v_new uuid;
  v_xfer uuid;
  v_reg uuid;
begin
  select id into v_admin from public.players where role = 'admin' and status = 'active' order by id limit 1;
  select array_agg(id order by id) into v_p
    from (select id from public.players where role = 'player' and status = 'active' order by id desc limit 10) s;
  v_t := pg_temp.event(4, now() + interval '10 days');

  -- CHECK 20: the captain is accepted on signup; the partner is pending and sees the invite
  perform pg_temp.act(v_p[1], false);
  select team_id into v_a from public.register_team_for_tournament(v_t, v_p[1], v_p[2]);
  if (select accepted_at from public.registrations where team_id = v_a and player_id = v_p[1]) is null
     or (select accepted_at from public.registrations where team_id = v_a and player_id = v_p[2]) is not null then
    raise exception 'CHECK 20a FAILED: acceptance markers';
  end if;
  perform pg_temp.act(v_p[2], false);
  if (select count(*) from public.get_my_team_invites() where team_id = v_a and captain_id = v_p[1]
        and account_created_by_captain = false) <> 1 then
    raise exception 'CHECK 20b FAILED: invite not listed';
  end if;
  perform pg_temp.act(v_p[3], false);
  select * into v_r from public.respond_to_team_invite(v_a, true);
  if v_r.status <> 'not_found' then raise exception 'CHECK 20c FAILED: %', v_r.status; end if;
  raise notice 'CHECK 20 ok: pending partner, invite listed, only the partner can respond';

  -- CHECK 21: while pending the captain can swap and cancel; after acceptance neither
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.change_team_partner(v_a, v_p[3]);
  if v_r.status <> 'changed' then raise exception 'CHECK 21a FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_p[3], false);
  select * into v_r from public.respond_to_team_invite(v_a, true);
  if v_r.status <> 'accepted' or exists (select 1 from public.get_my_team_invites()) then
    raise exception 'CHECK 21b FAILED: %', v_r.status;
  end if;
  select * into v_r from public.respond_to_team_invite(v_a, true);
  if v_r.status <> 'not_pending' then raise exception 'CHECK 21c FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.change_team_partner(v_a, v_p[4]);
  if v_r.status <> 'partner_accepted' then raise exception 'CHECK 21d FAILED: %', v_r.status; end if;
  select * into v_r from public.cancel_my_team(v_a);
  if v_r.status <> 'partner_accepted' then raise exception 'CHECK 21e FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.change_team_partner(v_a, v_p[4]);
  if v_r.status <> 'changed'
     or (select accepted_at from public.registrations where team_id = v_a and player_id = v_p[4] and status = 'registered') is not null then
    raise exception 'CHECK 21f FAILED: admin swap: %', v_r.status;
  end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 21 ok: swap while pending, locked after acceptance, admin still can';

  -- CHECK 22: a captain's cancel while pending promotes the waitlist; a decline cancels the team
  perform pg_temp.act(v_p[5], false);
  select team_id into v_b from public.register_team_for_tournament(v_t, v_p[5], v_p[6]);
  perform pg_temp.act(v_p[7], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[7], v_p[8]);
  v_c := v_r.team_id;
  if v_r.status <> 'waitlist' then raise exception 'CHECK 22a FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_p[6], false);
  select * into v_r from public.cancel_my_team(v_b);
  if v_r.status <> 'not_found' then raise exception 'CHECK 22b FAILED (partner cancelled): %', v_r.status; end if;
  select * into v_r from public.respond_to_team_invite(v_b, false);
  if v_r.status <> 'declined'
     or (select cancelled_reason from public.event_teams where id = v_b) <> 'partner_declined'
     or (select count(*) from public.registrations where team_id = v_b and status = 'cancelled') <> 2
     or (select count(*) from public.registrations where team_id = v_c and status = 'registered') <> 2 then
    raise exception 'CHECK 22c FAILED: decline: %', v_r.status;
  end if;
  perform pg_temp.act(v_p[7], false);
  select * into v_r from public.cancel_my_team(v_c);
  if v_r.status <> 'cancelled' or (select cancelled_reason from public.event_teams where id = v_c) <> 'captain_cancelled' then
    raise exception 'CHECK 22d FAILED: %', v_r.status;
  end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 22 ok: decline and captain cancel cancel the whole team, waitlist promoted';

  -- CHECK 23: once both accept, each player can transfer their own spot
  perform pg_temp.act(v_p[4], false);
  perform public.respond_to_team_invite(v_a, true);
  perform pg_temp.act(v_admin, true);
  perform public.set_registration_payment(
    (select id from public.registrations where team_id = v_a and player_id = v_p[1] and status = 'registered'), 'paid', 'tikkie');
  perform pg_temp.act(v_p[4], false);
  select * into v_r from public.create_transfer(v_p[5], v_t);
  if v_r.status <> 'ok' then raise exception 'CHECK 23a FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_p[5], false);
  select * into v_r from public.respond_to_transfer(v_r.transfer_id, true);
  if v_r.status <> 'accepted'
     or not exists (select 1 from public.registrations where team_id = v_a and player_id = v_p[5]
                      and status = 'registered' and payment_status = 'covered' and accepted_at is not null) then
    raise exception 'CHECK 23b FAILED: partner transfer: %', v_r.status;
  end if;
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.create_transfer(v_p[5], v_t);
  if v_r.status <> 'target_already_registered' then raise exception 'CHECK 23c FAILED: %', v_r.status; end if;
  select * into v_r from public.create_transfer(v_p[9], v_t);
  perform pg_temp.act(v_p[9], false);
  select * into v_r from public.respond_to_transfer(v_r.transfer_id, true);
  if v_r.status <> 'accepted'
     or (select captain_id from public.event_teams where id = v_a) <> v_p[9]
     or (select payment_status from public.registrations where team_id = v_a and player_id = v_p[9] and status = 'registered') <> 'paid' then
    raise exception 'CHECK 23d FAILED: captain transfer: %', v_r.status;
  end if;
  perform pg_temp.assert_teams(v_t);
  raise notice 'CHECK 23 ok: transfers after acceptance; captaincy and payment move with the captain';

  -- CHECK 24: payment writes go through set_registration_payment only
  v_t := pg_temp.event(8, now() + interval '10 days');
  update public.tournaments set entry_mode = 'individual', format = 'lobster_matching' where id = v_t;
  perform pg_temp.act(v_p[10], false);
  select registration_id into v_reg from public.register_for_tournament(v_t, v_p[10]);
  select * into v_r from public.set_registration_payment(v_reg, 'paid', 'cash');
  if v_r.status <> 'forbidden' then raise exception 'CHECK 24a FAILED: %', v_r.status; end if;
  select * into v_r from public.set_registration_payment(v_reg, 'tikkied', 'whatever');
  if v_r.status <> 'ok' or (select payment_method from public.registrations where id = v_reg) <> 'tikkie' then
    raise exception 'CHECK 24b FAILED: %', v_r.status;
  end if;
  select * into v_r from public.set_registration_payment(v_reg, 'pending_confirmation', 'tikkie');
  if v_r.status <> 'ok' then raise exception 'CHECK 24c FAILED: %', v_r.status; end if;
  select * into v_r from public.set_registration_payment(v_reg, 'unpaid', '');
  if v_r.status <> 'forbidden' then raise exception 'CHECK 24d FAILED: backwards allowed'; end if;
  perform pg_temp.act(v_p[9], false);
  select * into v_r from public.set_registration_payment(v_reg, 'tikkied', 'tikkie');
  if v_r.status <> 'forbidden' then raise exception 'CHECK 24e FAILED: other player''s row'; end if;
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.set_registration_payment(v_reg, 'paid', 'playtomic');
  if v_r.status <> 'ok' then raise exception 'CHECK 24f FAILED: %', v_r.status; end if;
  select * into v_r from public.set_registration_payment(
    (select id from public.registrations where team_id = v_a and player_id = v_p[5] and status = 'registered'), 'paid', 'cash');
  if v_r.status <> 'covered' then raise exception 'CHECK 24g FAILED: covered row changed'; end if;
  raise notice 'CHECK 24 ok: payment RPC (player forward-only, admin any, covered immutable)';

  raise notice 'ALL ACCEPTANCE AND PAYMENT CHECKS PASSED';
end $$;

do $$
declare
  v_p uuid[];
  v_t uuid;
  v_t2 uuid;
  v_r record;
  v_x record;
  v_team uuid;
  v_new uuid;
begin
  select array_agg(id order by id) into v_p
    from (select id from public.players where role = 'player' and status = 'active' order by id limit 14) s;

  -- CHECK 25: declining a transfer leaves the recipient's waitlisted team whole
  v_t := pg_temp.event(4, now() + interval '10 days');
  perform pg_temp.act(v_p[1], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[1], v_p[2]);
  v_team := v_r.team_id;
  perform pg_temp.act(v_p[2], false);
  perform public.respond_to_team_invite(v_team, true);
  perform pg_temp.act(v_p[3], false);
  perform public.register_team_for_tournament(v_t, v_p[3], v_p[4]);
  perform pg_temp.act(v_p[1], false);
  select * into v_x from public.create_transfer(v_p[5], v_t);
  perform pg_temp.act(v_p[5], false);
  select * into v_r from public.register_team_for_tournament(v_t, v_p[5], v_p[6]);
  if v_r.status <> 'waitlist' then raise exception 'CHECK 25a FAILED: %', v_r.status; end if;
  v_team := v_r.team_id;
  select * into v_r from public.respond_to_transfer(v_x.transfer_id, false);
  if v_r.status <> 'declined' then raise exception 'CHECK 25b FAILED: %', v_r.status; end if;
  perform pg_temp.assert_teams(v_t);
  if (select count(*) from public.registrations where team_id = v_team and status = 'waitlist') <> 2 then
    raise exception 'CHECK 25c FAILED: waitlisted team split';
  end if;
  raise notice 'CHECK 25 ok: transfer decline keeps a waitlisted team whole';

  -- CHECK 26: account_created_by_captain is about this event's invite only
  v_t := pg_temp.event(8, now() + interval '10 days');
  v_t2 := pg_temp.event(8, now() + interval '10 days');
  perform pg_temp.act(v_p[11], false);
  select * into v_r from public.register_team_for_tournament(
    v_t, v_p[11], null, '{"name": "Scoped One", "email": "te-scoped@test.invalid"}'::jsonb, true);
  if v_r.status <> 'registered' then raise exception 'CHECK 26a FAILED: %', v_r.status; end if;
  v_new := v_r.partner_id;
  perform pg_temp.act(v_p[12], false);
  select * into v_r from public.register_team_for_tournament(v_t2, v_p[12], v_new);
  if v_r.status <> 'registered' then raise exception 'CHECK 26b FAILED: %', v_r.status; end if;
  perform pg_temp.act(v_new, false);
  if (select account_created_by_captain from public.get_my_team_invites() where tournament_id = v_t) is not true
     or (select account_created_by_captain from public.get_my_team_invites() where tournament_id = v_t2) is not false then
    raise exception 'CHECK 26c FAILED: flag not scoped to the event';
  end if;
  raise notice 'CHECK 26 ok: account_created_by_captain scoped to the event';
end $$;

rollback;
