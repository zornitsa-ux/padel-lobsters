-- ============================================================================
-- Deleted accounts in the raffle and the Oscars (20261124160000,
-- docs/account-deletion AD3). A deleted account keeps its registration in a
-- past event; the draw must skip it and a vote for it is invalid_target.
-- A notes follow-up stops being listed once the noted player is deleted too.
--
-- Invented players only. One transaction, rolled back.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < supabase/tests/deleted_players_raffle_oscars.sql
-- ============================================================================

begin;

create function pg_temp.player(input_name text, input_role player_role default 'player') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.players(name, email, playtomic_level, gender, status, role)
  values (input_name, lower(replace(input_name, ' ', '.')) || '@example.test', 3, 'f', 'active', input_role)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.act(input_player uuid, input_admin boolean) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', input_player, 'role', 'authenticated',
    'app_metadata', case when input_admin then json_build_object('role', 'admin') else '{}'::json end
  )::text, true);
end $$;

create function pg_temp.check(input_ok boolean, input_label text) returns void
language plpgsql as $$
begin
  if input_ok is distinct from true then
    raise exception 'FAILED: %', input_label;
  end if;
end $$;

do $$
declare
  v_admin uuid := pg_temp.player('Ada Rafflecase', 'admin');
  v_voter uuid := pg_temp.player('Vic Rafflecase');
  v_gone uuid := pg_temp.player('Gwen Rafflecase');
  v_noter uuid := pg_temp.player('Nell Rafflecase');
  v_t uuid;
  v_session uuid;
  v_category uuid;
  v_winners uuid[];
begin
  insert into public.tournaments(name, date, time, max_players, entry_mode, format, status)
  values ('Raffle test', (now() at time zone 'Europe/Amsterdam')::date - 1, '20:00', 8,
          'individual', 'lobster_matching', 'completed')
  returning id into v_t;
  insert into public.registrations(tournament_id, player_id, status)
  values (v_t, v_voter, 'registered'), (v_t, v_gone, 'registered');

  insert into public.lobster_oscars_sessions(tournament_id, started_at)
  values (v_t, now()) returning id into v_session;
  insert into public.lobster_oscars_categories(session_id, name)
  values (v_session, 'Best smash') returning id into v_category;

  update public.players set notes = 'Partnered Gwen Rafflecase in October' where id = v_noter;
  perform private.delete_account(v_gone, true);
  perform pg_temp.check((select status from public.players where id = v_gone) = 'deleted',
                        'setup: the account is deleted');
  perform pg_temp.check((select status from public.registrations
                          where tournament_id = v_t and player_id = v_gone) = 'registered',
                        'setup: the past registration is kept');

  -- The draw asks for both; only the member can win, and the draw doesn't fail.
  perform pg_temp.act(v_admin, true);
  select array_agg(w.player_id) into v_winners
    from public.admin_draw_raffle_winners(v_t, 2) w;
  perform pg_temp.check(v_winners = array[v_voter], 'R1: the draw skips the deleted account');

  -- A vote for the deleted account is refused as a status, not an error.
  perform pg_temp.act(v_voter, false);
  perform pg_temp.check(public.lobster_oscars_cast_vote(v_category, v_gone) = 'invalid_target',
                        'O1: a vote for a deleted account is invalid_target');
  perform pg_temp.check(not exists (select 1 from public.lobster_oscars_votes where category_id = v_category),
                        'O2: no vote recorded');

  -- A note naming the deleted account is listed until the noted player is deleted too.
  perform pg_temp.act(v_admin, true);
  perform pg_temp.check(exists (select 1 from public.admin_list_deletion_followups() x
                                 where x.ref_table = 'players' and x.ref_id = v_noter::text),
                        'F1: the note is listed');
  perform private.delete_account(v_noter, true);
  perform pg_temp.check(not exists (select 1 from public.admin_list_deletion_followups() x
                                     where x.ref_table = 'players' and x.ref_id = v_noter::text),
                        'F2: not listed once the noted player is deleted');

  raise notice 'deleted players in the raffle and the Oscars ok';
end $$;

rollback;
