-- ============================================================================
-- Account deletion (20261124150000, docs/account-deletion/, PLAN AD2).
--
-- Invented players only. One transaction, rolled back. Deferred team checks
-- are forced with SET CONSTRAINTS, since a rollback never reaches commit.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < supabase/tests/account_deletion.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

-- A signed-in caller. input_code_age: seconds since an email-code sign-in,
-- or null for none; input_method lets a password sign-in stand in.
create function pg_temp.act(input_player uuid, input_admin boolean,
                            input_code_age integer default 30, input_method text default 'otp')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', input_player, 'role', 'authenticated',
    'app_metadata', case when input_admin then json_build_object('role', 'admin') else '{}'::json end,
    'amr', case when input_code_age is null then '[]'::json
                else json_build_array(json_build_object(
                  'method', input_method,
                  'timestamp', extract(epoch from now())::bigint - input_code_age)) end
  )::text, true);
end $$;

create function pg_temp.player(input_name text, input_role player_role default 'player') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.players(name, email, phone, notes, playtomic_level, gender, status, role,
                             country, tagline, birthday, avatar_url, playtomic_username)
  values (input_name, lower(replace(input_name, ' ', '.')) || '@example.test', '0600000000',
          'note', 3, 'f', 'active', input_role, 'NL', 'tag', '1990-05-06',
          'https://example.test/a.webp', 'handle')
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.event(input_name text, input_days integer, input_max integer,
                              input_entry text default 'individual',
                              input_status text default 'upcoming') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.tournaments(name, date, time, max_players, entry_mode, format, status)
  values (input_name, (now() at time zone 'Europe/Amsterdam')::date + input_days, '20:00', input_max,
          input_entry, case when input_entry = 'team' then 'king_of_court' else 'lobster_matching' end,
          input_status)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.check(input_ok boolean, input_label text) returns void
language plpgsql as $$
begin
  if input_ok is distinct from true then
    raise exception 'FAILED: %', input_label;
  end if;
end $$;

create function pg_temp.raises(input_sql text, input_message text) returns boolean
language plpgsql as $$
begin
  execute input_sql;
  return false;
exception when others then
  if sqlerrm <> input_message then
    raise exception 'expected %, got %', input_message, sqlerrm;
  end if;
  return true;
end $$;

create function pg_temp.teams_ok(input_tournament uuid) returns boolean
language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
  return not exists (
    select 1 from public.event_teams et
      left join public.registrations r on r.team_id = et.id and r.status in ('registered', 'waitlist')
     where et.tournament_id = input_tournament
     group by et.id
    having count(r.id) not in (0, 2) or count(distinct r.status) > 1
  );
end $$;

do $$
declare
  v_admin uuid := pg_temp.player('Ada Testadmin', 'admin');
  v_admin2 uuid := pg_temp.player('Abe Testadmin', 'admin');
  v_m uuid := pg_temp.player('Marlowe Testcase');
  v_y uuid := pg_temp.player('Yuki Testcase');
  v_w uuid := pg_temp.player('Wren Testcase');
  v_x uuid := pg_temp.player('Xavi Testcase');
  v_al uuid := pg_temp.player('Al Testcase');
  v_live uuid := pg_temp.player('Livia Testcase');
  v_a uuid := pg_temp.player('Ana Teamtest');
  v_b uuid := pg_temp.player('Bo Teamtest');
  v_c uuid := pg_temp.player('Cy Teamtest');
  v_d uuid := pg_temp.player('Di Teamtest');
  v_e uuid := pg_temp.player('Ed Teamtest');
  v_f uuid := pg_temp.player('Flo Teamtest');
  v_t0 uuid; v_t1 uuid; v_t2 uuid; v_tl uuid; v_tt uuid;
  v_league uuid; v_lt uuid; v_lt_al uuid;
  v_item integer;
  v_item2 integer;
  v_team1 uuid; v_team2 uuid; v_team3 uuid; v_team4 uuid;
  v_tt2 uuid;
  v_g uuid := pg_temp.player('Gus Teamtest');
  v_h uuid := pg_temp.player('Hal Teamtest');
  v_match uuid;
  v_r record;
  v_counts_before text;
  v_counts_after text;
  v_name text;
  v_summary jsonb;
  v_new uuid;
begin
  -- ── Fixtures ──────────────────────────────────────────────────────────────
  v_t0 := pg_temp.event('Done test', -30, 8, 'individual', 'completed');
  insert into public.registrations(tournament_id, player_id, status, payment_status)
  values (v_t0, v_m, 'registered', 'paid'), (v_t0, v_y, 'registered', 'paid');
  insert into public.matches(tournament_id, round, team1_ids, team2_ids, score1, score2, completed)
  values (v_t0, 1, array[v_m, v_y], array[v_w, v_x], 6, 4, true) returning id into v_match;
  insert into public.rating_events(kind, tournament_id, player_id, prior_mu, prior_sigma,
                                   proposed_delta, applied_delta, breakdown)
  values ('tournament', v_t0, v_m, 3, 0.7, 0.1, 0.1, '[]');

  v_t1 := pg_temp.event('Next test', 10, 2);
  perform pg_temp.act(v_admin, true);
  perform public.register_for_tournament(v_t1, v_m);
  perform public.register_for_tournament(v_t1, v_y);
  perform public.register_for_tournament(v_t1, v_w);
  update public.registrations set payment_status = 'paid' where tournament_id = v_t1 and player_id = v_m;
  perform pg_temp.check((select status from public.registrations where tournament_id = v_t1 and player_id = v_w) = 'waitlist',
                        'fixture: third player waits');

  v_t2 := pg_temp.event('Transfer test', 12, 8);
  perform public.register_for_tournament(v_t2, v_y);
  perform pg_temp.act(v_y, false);
  select * into v_r from public.create_transfer(v_m, v_t2, v_y);
  perform pg_temp.check(v_r.status = 'ok', 'fixture: transfer to M pending, got ' || coalesce(v_r.status, 'null'));

  v_tl := pg_temp.event('Live test', 0, 8);
  perform pg_temp.act(v_admin, true);
  perform public.register_for_tournament(v_tl, v_live);

  insert into public.leagues(name, status) values ('League test', 'group_stage') returning id into v_league;
  insert into public.league_teams(league_id, division, player1_id, player2_id, team_name, experience_level)
  values (v_league, 'mens', v_m, v_x, 'Marlowe and friends', 'intermediate') returning id into v_lt;
  insert into public.league_teams(league_id, division, player1_id, player2_id, team_name, experience_level)
  values (v_league, 'womens', v_al, v_w, 'Al dente', 'intermediate') returning id into v_lt_al;

  insert into public.merch_items(name) values ('Test shirt') returning id into v_item;
  insert into public.merch_items(name) values ('Test cap') returning id into v_item2;
  insert into public.merch_interests(player_id, merch_item_id, custom_name, status)
  values (v_m::text, v_item, 'MARLOWE', 'ordered');
  insert into public.merch_interests(player_id, merch_item_id, custom_name, status, delivered)
  values (v_m::text, v_item2, 'MARLOWE', 'delivered', true);

  insert into public.player_aliases(historical_name, player_id) values ('Old Name Testcase', v_m);
  insert into public.player_email_clears(player_id, old_email, cleared_via) values (v_m, 'old@example.test', 'admin');
  insert into public.security_events(player_id, attempt_kind, succeeded) values (v_m, 'signup', true);

  select format('%s/%s/%s',
    (select count(*) from public.registrations where tournament_id = v_t0),
    (select count(*) from public.matches where tournament_id = v_t0),
    (select count(*) from public.rating_events where tournament_id = v_t0))
    into v_counts_before;

  -- ── Refusals ──────────────────────────────────────────────────────────────
  perform pg_temp.act(v_m, false, null);
  perform pg_temp.check((select status from public.delete_my_account()) = 'code_required', 'R1: no code');
  perform pg_temp.act(v_m, false, 900);
  perform pg_temp.check((select status from public.delete_my_account()) = 'code_required', 'R2: stale code');
  perform pg_temp.act(v_m, false, 30, 'password');
  perform pg_temp.check((select status from public.delete_my_account()) = 'code_required', 'R3: password sign-in');
  perform pg_temp.act(v_admin2, true);
  perform pg_temp.check((select status from public.delete_my_account()) = 'admin_must_step_down', 'R4: admin self');
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check((select status from public.admin_delete_account(v_admin2)) = 'admin_must_step_down', 'R5: admin target');
  perform pg_temp.check((select status from public.admin_delete_account(v_admin)) = 'cannot_delete_self', 'R6: admin deletes self');
  perform pg_temp.check((select status from public.admin_delete_account(gen_random_uuid())) = 'not_found', 'R7: unknown');
  perform pg_temp.act(v_live, false);
  perform pg_temp.check((select status from public.delete_my_account()) = 'in_live_event', 'R8: live event');
  perform pg_temp.check((public.get_my_deletion_summary() ->> 'in_live_event')::boolean, 'R8: summary says live');
  perform pg_temp.act(v_m, false);
  perform pg_temp.check(pg_temp.raises('select public.admin_delete_account(''' || v_y || ''')',
                                       'unauthorized: admin required'), 'R9: member uses the admin RPC');
  raise notice 'refusals ok';

  -- ── Summary ───────────────────────────────────────────────────────────────
  v_summary := public.get_my_deletion_summary();
  perform pg_temp.check(jsonb_array_length(v_summary -> 'upcoming') = 1
                        and (v_summary #>> '{upcoming,0,paid}')::boolean
                        and jsonb_array_length(v_summary -> 'league_teams') = 1
                        and (v_summary ->> 'open_shop_requests')::int = 1
                        and (v_summary ->> 'pending_transfers')::int = 1
                        and not (v_summary ->> 'in_live_event')::boolean
                        and not (v_summary ->> 'is_admin')::boolean,
                        'S1: summary ' || v_summary::text);
  raise notice 'summary ok';

  -- ── A full deletion ───────────────────────────────────────────────────────
  perform pg_temp.check((select status from public.delete_my_account()) = 'deleted', 'D1: deleted');
  select name into v_name from public.players where id = v_m;
  perform pg_temp.check(private.is_anonymised_name(v_name), 'D2: anonymised name ' || v_name);
  perform pg_temp.check(exists (
    select 1 from public.players p where p.id = v_m and p.status = 'deleted' and p.email is null
       and p.phone = '' and p.notes = '' and p.playtomic_level is null and p.playtomic_username = ''
       and p.gender = '' and p.country = '' and p.birthday is null and p.tagline = ''
       and p.avatar_url = '' and p.role = 'player'), 'D3: personal info wiped');
  perform pg_temp.check(not exists (select 1 from auth.users where id = v_m), 'D4: auth user gone');
  perform pg_temp.check(not exists (select 1 from public.player_aliases where player_id = v_m)
                        and not exists (select 1 from public.player_email_clears where player_id = v_m),
                        'D5: aliases and old emails gone');
  perform pg_temp.check((select array_agg(attempt_kind) from public.security_events where player_id = v_m)
                        = array['account_deleted_self'], 'D6: one deletion event');

  select format('%s/%s/%s',
    (select count(*) from public.registrations where tournament_id = v_t0),
    (select count(*) from public.matches where tournament_id = v_t0),
    (select count(*) from public.rating_events where tournament_id = v_t0))
    into v_counts_after;
  perform pg_temp.check(v_counts_before = v_counts_after
                        and (select status from public.registrations where tournament_id = v_t0 and player_id = v_m) = 'registered',
                        'D7: completed event untouched ' || v_counts_before || ' vs ' || v_counts_after);

  perform pg_temp.check((select status from public.registrations where tournament_id = v_t1 and player_id = v_m) = 'cancelled'
                        and (select status from public.registrations where tournament_id = v_t1 and player_id = v_w) = 'registered',
                        'D8: upcoming spot cancelled, waitlist promoted');
  perform pg_temp.check((select status from public.registration_transfers where to_player_id = v_m) = 'cancelled'
                        and (select closed_reason from public.registration_transfers where to_player_id = v_m) = 'account_deleted',
                        'D9: transfer cancelled');
  perform pg_temp.check(exists (select 1 from public.league_teams where id = v_lt and player1_id = v_m), 'D10: league team kept');
  perform pg_temp.check((select count(*) from public.merch_interests where player_id = v_m::text and status = 'cancelled') = 1
                        and (select count(*) from public.merch_interests where player_id = v_m::text and status = 'delivered') = 1
                        and not exists (select 1 from public.merch_interests where player_id = v_m::text and custom_name is not null),
                        'D11: open shop request cancelled, names cleared');
  perform pg_temp.check(exists (select 1 from public.account_deletion_followups
                                 where player_id = v_m and ref_table = 'league_teams' and ref_id = v_lt::text
                                   and ref_column = 'team_name'), 'D12: follow-up for the team name');
  perform pg_temp.check((select status from public.delete_my_account()) = 'already_deleted', 'D13: twice');
  raise notice 'full deletion ok';

  -- ── Ratings still apply ───────────────────────────────────────────────────
  update public.players set mm_rating = 3.2, mm_sigma = 0.6, mm_rating_updated_at = now() where id = v_m;
  perform pg_temp.check((select mm_rating from public.players where id = v_m) = 3.2, 'G1: rating update passes');
  raise notice 'ratings ok';

  -- ── The leftover token ────────────────────────────────────────────────────
  perform pg_temp.act(v_m, false);
  perform pg_temp.check(pg_temp.raises('select public.update_my_profile(''{"name":"Back Again","phone":"0611111111"}'')',
                                       'player_deleted'), 'L1: profile write refused');
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.register_for_tournament(v_t2, v_m);
  perform pg_temp.check(v_r.status not in ('registered', 'waitlist'), 'L2a: registering a deleted player, got ' || v_r.status);
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.registrations(tournament_id, player_id, status) values (%L, %L, ''waitlist'')', v_t2, v_m),
    'player_deleted'), 'L2b: any insert of a deleted player''s spot');
  perform pg_temp.act(v_y, false);
  select * into v_r from public.create_transfer(v_m, v_t2, v_y);
  perform pg_temp.check(v_r.status <> 'ok', 'L3a: transfer to a deleted player, got ' || v_r.status);
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.registration_transfers(tournament_id, from_player_id, to_player_id, status) values (%L, %L, %L, ''pending'')',
    v_t2, v_y, v_m), 'player_deleted'), 'L3b: any pending transfer to a deleted player');
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.league_teams(league_id, division, player1_id, player2_id, experience_level) values (%L, ''mens'', %L, %L, ''x'')',
    v_league, v_y, v_m), 'player_deleted'), 'L4: pairing a deleted player');
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.raffle_winners(player_id, won_at_date) values (%L, current_date)', v_m),
    'player_deleted'), 'L5: a raffle win for a deleted player');
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.matches(tournament_id, team1_ids, team2_ids) values (%L, array[%L, %L]::uuid[], array[%L, %L]::uuid[])',
    v_t2, v_m, v_y, v_w, v_x), 'player_deleted'), 'L6: a deleted player in a new match');
  update public.matches set score1 = 7 where id = v_match;
  perform pg_temp.check((select score1 from public.matches where id = v_match) = 7, 'L7: score on an existing match');
  perform pg_temp.check(pg_temp.raises(format(
    'update public.registrations set status = ''waitlist'' where tournament_id = %L and player_id = %L', v_t1, v_m),
    'player_deleted'), 'L8: re-entering a cancelled spot');
  raise notice 'leftover token ok';

  -- ── Reserved names ────────────────────────────────────────────────────────
  perform pg_temp.check(public.before_user_created_hook(jsonb_build_object('user', jsonb_build_object(
                          'user_metadata', jsonb_build_object('name', 'Anonymous Octopus #3'))))
                        #>> '{error,message}' = 'Please enter your own name.', 'N1: signup refuses');
  perform pg_temp.act(v_y, false);
  perform pg_temp.check(pg_temp.raises('select public.update_my_profile(''{"name":"anonymous  octopus #3"}'')',
                                       'reserved_name'), 'N2: profile refuses a lookalike');
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check(pg_temp.raises(format('select public.admin_update_player(%L, ''{"name":"Anonymous Octopus #3"}'')', v_y),
                                       'reserved_name'), 'N3: admin edit refuses');
  perform pg_temp.check(pg_temp.raises(format(
    'select public.admin_create_league_team(jsonb_build_object(''league_id'', %L, ''division'', ''mens'', ''player1_name'', ''Anonymous Crab #9'', ''player2_id'', %L, ''experience_level'', ''x''))',
    v_league, v_x), 'reserved_name'), 'N4: league placeholder refuses');
  perform pg_temp.check((select name from public.players where id = v_y) = 'Yuki Testcase', 'N5: name unchanged');
  raise notice 'reserved names ok';

  -- ── Follow-ups and a short first name ─────────────────────────────────────
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check((select status from public.admin_delete_account(v_al)) = 'deleted', 'F1: admin deletes');
  perform pg_temp.check(not exists (select 1 from public.account_deletion_followups where player_id = v_al),
                        'F2: no follow-up for a 2-letter first name');
  perform pg_temp.check((select array_agg(attempt_kind) from public.security_events where player_id = v_al)
                        = array['account_deleted_admin'], 'F3: admin deletion event');
  perform pg_temp.check((select count(*) from public.admin_list_deletion_followups() where kind = 'league_team') = 2
                        and (select count(*) from public.admin_list_deletion_followups() where kind = 'free_text') = 1,
                        'F4: follow-ups listed');
  perform pg_temp.check((select status from public.admin_dismiss_deletion_followup(
                          (select followup_id from public.admin_list_deletion_followups() where kind = 'free_text'))) = 'dismissed',
                        'F5a: dismissed');
  perform pg_temp.check(not exists (select 1 from public.admin_list_deletion_followups() where kind = 'free_text'),
                        'F5b: gone from the list');
  raise notice 'follow-ups ok';

  -- ── Team events ───────────────────────────────────────────────────────────
  v_tt := pg_temp.event('Team test', 14, 4, 'team');
  perform pg_temp.act(v_a, false);
  select team_id into v_team1 from public.register_team_for_tournament(v_tt, v_a, v_b, null, false);
  perform pg_temp.act(v_c, false);
  select team_id into v_team2 from public.register_team_for_tournament(v_tt, v_c, v_d, null, false);
  perform pg_temp.act(v_e, false);
  select team_id into v_team3 from public.register_team_for_tournament(v_tt, v_e, v_f, null, false);
  perform pg_temp.act(v_b, false);
  perform public.respond_to_team_invite(v_team1, true);
  perform pg_temp.check((select count(*) from public.registrations where team_id = v_team3 and status = 'waitlist') = 2,
                        'fixture: third team waits');

  -- The captain goes: the partner captains, both rows stay.
  perform pg_temp.act(v_a, false);
  perform pg_temp.check((select status from public.delete_my_account()) = 'deleted', 'T1: captain deletes');
  perform pg_temp.check((select captain_id from public.event_teams where id = v_team1) = v_b
                        and (select count(*) from public.registrations where team_id = v_team1 and status = 'registered') = 2
                        and pg_temp.teams_ok(v_tt), 'T2: partner captains, spot kept');
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check((select count(*) from public.admin_list_deletion_followups() where kind = 'event_team') = 1,
                        'T3: team in follow-ups');

  -- The new captain can replace the deleted, accepted partner.
  perform pg_temp.act(v_b, false);
  select * into v_r from public.change_team_partner(v_team1, v_x, null, false);
  perform pg_temp.check(v_r.status = 'changed' and pg_temp.teams_ok(v_tt),
                        'T4: captain replaces the deleted partner, got ' || v_r.status);
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check(not exists (select 1 from public.admin_list_deletion_followups() where kind = 'event_team'),
                        'T5: follow-up clears itself');

  -- A waitlisted team with a deleted member is still promoted.
  perform pg_temp.act(v_f, false);
  perform pg_temp.check((select status from public.delete_my_account()) = 'deleted', 'T6: waitlisted partner deletes');
  perform pg_temp.act(v_admin, true);
  perform public.admin_cancel_team(v_team2);
  perform pg_temp.check((select count(*) from public.registrations where team_id = v_team3 and status = 'registered') = 2
                        and pg_temp.teams_ok(v_tt), 'T7: team with a deleted member promoted');

  -- Both members gone: the team is cancelled.
  perform pg_temp.act(v_e, false);
  perform pg_temp.check((select status from public.delete_my_account()) = 'deleted', 'T8: second member deletes');
  perform pg_temp.check(not exists (select 1 from public.registrations where team_id = v_team3 and status <> 'cancelled')
                        and (select cancelled_reason from public.event_teams where id = v_team3) = 'account_deleted'
                        and pg_temp.teams_ok(v_tt), 'T9: team cancelled');

  -- The captain goes before the partner accepted: the partner never agreed,
  -- so the team is cancelled rather than handed to them.
  v_tt2 := pg_temp.event('Team test two', 15, 4, 'team');
  perform pg_temp.act(v_g, false);
  select team_id into v_team4 from public.register_team_for_tournament(v_tt2, v_g, v_h, null, false);
  perform pg_temp.check((select accepted_at from public.registrations where team_id = v_team4 and player_id = v_h) is null,
                        'fixture: partner has not accepted');
  perform pg_temp.check((select status from public.delete_my_account()) = 'deleted', 'T10: captain deletes first');
  perform pg_temp.check(not exists (select 1 from public.registrations where team_id = v_team4 and status <> 'cancelled')
                        and (select captain_id from public.event_teams where id = v_team4) = v_g
                        and pg_temp.teams_ok(v_tt2), 'T11: unaccepted partner is not made captain; team cancelled');
  raise notice 'team events ok';

  -- ── Joining again with the same email ─────────────────────────────────────
  v_new := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'marlowe.testcase@example.test', now(), '{}', '{"name":"Marlowe Testcase"}', now(), now());
  perform pg_temp.check(exists (select 1 from public.players where id = v_new and status = 'active'
                                   and email = 'marlowe.testcase@example.test'), 'J1: a new member');
  perform pg_temp.check((select name from public.players where id = v_m) = v_name, 'J2: old row untouched');
  raise notice 'joining again ok';

  -- ── A reserved name from an old signup doesn't fail the confirmation ─────
  v_new := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'old.signup@example.test', null, '{}', '{"name":"Anonymous Crab #3"}', now(), now());
  update auth.users set email_confirmed_at = now() where id = v_new;
  perform pg_temp.check(exists (select 1 from auth.users where id = v_new and email_confirmed_at is not null)
                        and not exists (select 1 from public.players where id = v_new),
                        'C1: confirmed, no player with a reserved name');
  raise notice 'old signup with a reserved name ok';
end $$;

rollback;
