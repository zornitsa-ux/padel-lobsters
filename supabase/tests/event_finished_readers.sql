-- ============================================================================
-- Readers of "finished" (20261127120000, docs/event-system/, PLAN EV1,
-- DESIGN §3 "Database").
--
-- Invented players only. One transaction, rolled back. Deferred team checks
-- are forced with SET CONSTRAINTS, since a rollback never reaches commit.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < supabase/tests/event_finished_readers.sql
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

create function pg_temp.nobody() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
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

-- input_time null: the current Amsterdam time, so the event has just started.
create function pg_temp.event(input_days integer, input_team boolean,
                              input_status text default 'upcoming',
                              input_time text default '20:00') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.tournaments(name, date, time, duration, max_players, entry_mode, format, status)
  values ('Finished readers test', (now() at time zone 'Europe/Amsterdam')::date + input_days,
          coalesce(input_time, to_char(now() at time zone 'Europe/Amsterdam', 'HH24:MI')), 90, 16,
          case when input_team then 'team' else 'individual' end,
          case when input_team then 'king_of_court' else 'lobster_matching' end,
          input_status)
  returning id into v_id;
  return v_id;
end $$;

-- A pair as signup leaves it: the captain accepted, the partner not yet.
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

create function pg_temp.solo(input_tournament uuid, input_player uuid) returns void
language sql as $$
  insert into public.registrations(tournament_id, player_id, status, payment_status, payment_method)
  values (input_tournament, input_player, 'registered', 'unpaid', '');
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
  v_admin uuid := pg_temp.player('Ada Finishtest', 'admin');
  v_ka uuid := pg_temp.player('Kai Finishtest');
  v_kb uuid := pg_temp.player('Kit Finishtest');
  v_kc uuid := pg_temp.player('Kim Finishtest');
  v_kd uuid := pg_temp.player('Kip Finishtest');
  v_ke uuid := pg_temp.player('Kaz Finishtest');
  v_kf uuid := pg_temp.player('Kev Finishtest');
  v_aa uuid := pg_temp.player('Ana Finishtest');
  v_ab uuid := pg_temp.player('Abe Finishtest');
  v_ac uuid := pg_temp.player('Ace Finishtest');
  v_ad uuid := pg_temp.player('Ari Finishtest');
  v_ca uuid := pg_temp.player('Cy Finishtest');
  v_kotc_past uuid := pg_temp.event(-1, true);
  v_kotc_now uuid := pg_temp.event(0, true, 'upcoming', null);
  v_amer_past uuid := pg_temp.event(-1, false);
  v_amer_next uuid := pg_temp.event(7, false);
  v_amer_done uuid := pg_temp.event(1, false, 'completed');
  v_summary jsonb;
  v_r record;
  v_src text;
begin
  perform pg_temp.team(v_kotc_past, v_ka, v_kb);
  perform pg_temp.team(v_kotc_now, v_kc, v_kd);
  perform pg_temp.solo(v_amer_past, v_aa);
  perform pg_temp.solo(v_amer_next, v_aa);
  perform pg_temp.solo(v_amer_done, v_ca);
  set constraints all immediate;
  set constraints all deferred;

  -- 1. A King of the Court dated yesterday, never completed: finished.
  perform pg_temp.check(private.event_finished(v_kotc_past), 'K1: past KotC is finished');
  perform pg_temp.check(private.has_played_night(v_ka) and private.has_played_night(v_kb),
                        'K1: both players have a played night');
  perform pg_temp.check(not private.in_live_event(v_ka), 'K1: not in a live event');

  perform pg_temp.act(v_kb, false);
  perform pg_temp.check(not exists (select 1 from public.get_my_team_invites() i where i.tournament_id = v_kotc_past),
                        'K1: the invite to a finished event is hidden');

  perform pg_temp.act(v_ke, false);
  select * into v_r from public.register_team_for_tournament(v_kotc_past, v_ke, v_kf);
  perform pg_temp.check(v_r.status = 'event_finished', 'K1: a captain cannot sign up, got ' || v_r.status);

  perform pg_temp.act(v_admin, true);
  select * into v_r from public.register_team_for_tournament(v_kotc_past, v_ke, v_kf);
  perform pg_temp.check(v_r.status = 'registered', 'K1: an admin can sign a pair up, got ' || v_r.status);
  set constraints all immediate;
  set constraints all deferred;

  perform pg_temp.nobody();
  v_summary := private.deletion_summary(v_ka);
  perform pg_temp.check(jsonb_array_length(v_summary -> 'upcoming') = 0
                        and jsonb_array_length(v_summary -> 'team_events') = 0
                        and not (v_summary ->> 'in_live_event')::boolean,
                        'K1: the deletion summary has no upcoming spot');
  raise notice 'K1 ok: past King of the Court counts as played, takes no player signups';

  -- 2. The same format today, before its end: live, open to signups.
  perform pg_temp.check(not private.event_finished(v_kotc_now), 'K2: not finished yet');
  perform pg_temp.check(private.in_live_event(v_kc), 'K2: in a live event');
  perform pg_temp.check(not private.has_played_night(v_kc), 'K2: no played night yet');
  perform pg_temp.act(v_kd, false);
  perform pg_temp.check(exists (select 1 from public.get_my_team_invites() i where i.tournament_id = v_kotc_now),
                        'K2: the invite shows');
  perform pg_temp.act(v_ke, false);
  select * into v_r from public.register_team_for_tournament(v_kotc_now, v_ke, v_kf);
  perform pg_temp.check(v_r.status = 'registered', 'K2: a captain can sign up, got ' || v_r.status);
  set constraints all immediate;
  set constraints all deferred;
  perform pg_temp.nobody();
  perform pg_temp.check((private.deletion_summary(v_kc) ->> 'in_live_event')::boolean
                        and jsonb_array_length(private.deletion_summary(v_kc) -> 'team_events') = 1,
                        'K2: the deletion summary lists the live team spot');
  raise notice 'K2 ok: King of the Court today, before its end, is live and open';

  -- 3. An Americano past its end, not completed: finished; admin paths open.
  perform pg_temp.check(private.event_finished(v_amer_past), 'A3: past Americano is finished');
  perform pg_temp.check(private.has_played_night(v_aa), 'A3: a played night');
  perform pg_temp.act(v_ac, false);
  select * into v_r from public.register_for_tournament(v_amer_past, v_ac);
  perform pg_temp.check(v_r.status = 'event_finished', 'A3: a player cannot sign up, got ' || v_r.status);
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.register_for_tournament(v_amer_past, v_ac);
  perform pg_temp.check(v_r.status = 'registered', 'A3: an admin can sign a player up, got ' || v_r.status);
  select * into v_r from public.admin_transfer_registration(v_amer_past, v_ac, v_ab);
  perform pg_temp.check(v_r.status = 'accepted', 'A3: an admin can still transfer, got ' || v_r.status);
  perform pg_temp.nobody();
  v_summary := private.deletion_summary(v_aa);
  perform pg_temp.check(jsonb_array_length(v_summary -> 'upcoming') = 1
                        and (v_summary -> 'upcoming' -> 0 ->> 'tournament_id')::uuid = v_amer_next,
                        'A3: only the next event counts as upcoming');

  -- Deleting the account cancels the next spot and keeps the finished one,
  -- so ratings can still be applied to it.
  perform private.delete_account(v_aa, true);
  perform pg_temp.check((select r.status from public.registrations r
                          where r.tournament_id = v_amer_past and r.player_id = v_aa) = 'registered',
                        'A3: the finished spot stays after deletion');
  perform pg_temp.check((select r.status from public.registrations r
                          where r.tournament_id = v_amer_next and r.player_id = v_aa) = 'cancelled',
                        'A3: the next spot is cancelled by deletion');
  raise notice 'A3 ok: past Americano counts as played; admins can still sign up and transfer';

  -- 4. Completed before its end: finished, and closed to admins as today.
  perform pg_temp.check(private.event_finished(v_amer_done), 'C4: completed is finished');
  perform pg_temp.check(not private.in_live_event(v_ca), 'C4: not live');
  perform pg_temp.act(v_ad, false);
  select * into v_r from public.register_for_tournament(v_amer_done, v_ad);
  perform pg_temp.check(v_r.status = 'event_finished', 'C4: a player cannot sign up, got ' || v_r.status);
  perform pg_temp.act(v_admin, true);
  select * into v_r from public.admin_transfer_registration(v_amer_done, v_ca, v_ad);
  perform pg_temp.check(v_r.status = 'tournament_completed', 'C4: no admin transfer, got ' || v_r.status);
  raise notice 'C4 ok: completed before the end is finished';

  -- 5. Reminders pick events by "not finished" instead of status. The
  -- function posts to the edge function, so its query is checked instead.
  v_src := (select p.prosrc from pg_proc p where p.oid = 'private.send_tournament_reminders'::regproc);
  perform pg_temp.check(v_src like '%where not private.event_finished(t.id)%'
                        and v_src not like '%t.status = ''upcoming''%',
                        'R5: reminders skip finished events');
  raise notice 'R5 ok: reminders skip finished events';

  -- 6. A deleted partner's team is an admin follow-up only while it's live.
  perform pg_temp.nobody();
  perform private.delete_account(v_kd, true);
  perform private.delete_account(v_kb, true);
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check(not exists (select 1 from public.admin_list_deletion_followups() f
                                     where f.kind = 'event_team' and f.context_id = v_kotc_past::text),
                        'F6: no follow-up for a finished event');
  perform pg_temp.check(exists (select 1 from public.admin_list_deletion_followups() f
                                 where f.kind = 'event_team' and f.context_id = v_kotc_now::text),
                        'F6: a follow-up for the live event');
  raise notice 'F6 ok: follow-ups skip finished events';

  -- 7. Start and end defaults (EV-D4): a missing time is 19:00, not 00:00.
  update public.tournaments set time = null, duration = null where id = v_amer_next;
  perform pg_temp.check(public.tournament_start_ts(v_amer_next) at time zone 'Europe/Amsterdam'
                          = ((now() at time zone 'Europe/Amsterdam')::date + 7) + time '19:00',
                        'D7: missing time starts at 19:00');
  perform pg_temp.check(public.tournament_end_ts(v_amer_next) - public.tournament_start_ts(v_amer_next)
                          = interval '90 minutes',
                        'D7: missing duration lasts 90 minutes');
  raise notice 'D7 ok: start and end defaults';
end $$;

rollback;
