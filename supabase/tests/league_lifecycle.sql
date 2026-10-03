-- ============================================================================
-- League lifecycle checks.
--
-- Covers finals creation through admin_create_bracket_matches, the phase
-- readiness checks in admin_update_league_status (20261003120000,
-- 20261003130000), league visibility (RLS on published_at), and the
-- publish / edit / delete RPCs.
--
-- Plain script, same shape as registration_integrity.sql: every check raises
-- on failure and the whole run rolls back.
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/league_lifecycle.sql
-- ============================================================================

begin;

set local client_min_messages = notice;

do $$
declare
  v_league uuid;
  v_other uuid;
  v_players uuid[];
  v_teams uuid[];
  v_final uuid;
  v_status text;
  v_err text;
begin
  -- ── Fixtures: one knockout league, 8 mens teams, decided gold + silver semis
  with ins as (
    insert into public.players (name, status)
    select 'League Test P' || lpad(g::text, 2, '0'), 'active' from generate_series(1, 16) g
    returning id, name
  )
  select array_agg(id order by name) into v_players from ins;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_players[1],
      'app_metadata', json_build_object('role', 'admin')
    )::text,
    true
  );

  insert into public.leagues (name, status, divisions)
  values ('LEAGUE LIFECYCLE TEST', 'knockout', array['mens'])
  returning id into v_league;

  with ins as (
    insert into public.league_teams
      (league_id, division, player1_id, player2_id, experience_level, team_name)
    select v_league, 'mens', v_players[g * 2 - 1], v_players[g * 2], 'intermediate', 'T' || g
      from generate_series(1, 8) g
    returning id, team_name
  )
  select array_agg(id order by team_name) into v_teams from ins;

  insert into public.league_matches (league_id, division, stage, team1_id, team2_id, winner_id)
  values
    (v_league, 'mens', 'gold_semi',   v_teams[1], v_teams[2], v_teams[1]),
    (v_league, 'mens', 'gold_semi',   v_teams[3], v_teams[4], v_teams[4]),
    (v_league, 'mens', 'silver_semi', v_teams[5], v_teams[6], v_teams[6]),
    (v_league, 'mens', 'silver_semi', v_teams[7], v_teams[8], v_teams[7]);

  -- ── 1. Completion is refused while no finals exist ────────────────────────
  begin
    perform public.admin_update_league_status(v_league, 'completed');
    raise exception 'CHECK 1 FAILED: completed a league with no finals';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'every final needs a result%' then raise; end if;
  end;
  raise notice 'CHECK 1 ok  — completion refused with no finals';

  -- ── 2. Finals can be created once per tier ────────────────────────────────
  perform public.admin_create_bracket_matches(v_league, jsonb_build_object('matches', jsonb_build_array(
    jsonb_build_object('division', 'mens', 'stage', 'gold_final',
                       'team1_id', v_teams[1], 'team2_id', v_teams[4])
  )));
  begin
    perform public.admin_create_bracket_matches(v_league, jsonb_build_object('matches', jsonb_build_array(
      jsonb_build_object('division', 'mens', 'stage', 'gold_final',
                         'team1_id', v_teams[1], 'team2_id', v_teams[4])
    )));
    raise exception 'CHECK 2 FAILED: a second gold final was created';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'matches already exist%' then raise; end if;
  end;
  raise notice 'CHECK 2 ok  — gold final created, duplicate refused';

  -- ── 3. An undecided final still blocks completion ─────────────────────────
  begin
    perform public.admin_update_league_status(v_league, 'completed');
    raise exception 'CHECK 3 FAILED: completed with an undecided gold final';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'every final needs a result%' then raise; end if;
  end;
  raise notice 'CHECK 3 ok  — undecided gold final blocks completion';

  -- ── 4. A decided gold final with the silver final missing still blocks ────
  select id into v_final from public.league_matches
   where league_id = v_league and stage = 'gold_final';
  perform public.admin_record_league_match_result(jsonb_build_object(
    'match_id', v_final,
    'sets', jsonb_build_array(jsonb_build_object('t1', 6, 't2', 3), jsonb_build_object('t1', 6, 't2', 4))
  ));
  begin
    perform public.admin_update_league_status(v_league, 'completed');
    raise exception 'CHECK 4 FAILED: completed with the silver final missing';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'every final needs a result%' then raise; end if;
  end;
  raise notice 'CHECK 4 ok  — missing silver final blocks completion';

  -- ── 5. All finals decided → completion succeeds ───────────────────────────
  perform public.admin_create_bracket_matches(v_league, jsonb_build_object('matches', jsonb_build_array(
    jsonb_build_object('division', 'mens', 'stage', 'silver_final',
                       'team1_id', v_teams[6], 'team2_id', v_teams[7])
  )));
  select id into v_final from public.league_matches
   where league_id = v_league and stage = 'silver_final';
  perform public.admin_record_league_match_result(jsonb_build_object(
    'match_id', v_final,
    'sets', jsonb_build_array(jsonb_build_object('t1', 2, 't2', 6), jsonb_build_object('t1', 3, 't2', 6))
  ));
  perform public.admin_update_league_status(v_league, 'completed');
  select status into v_status from public.leagues where id = v_league;
  if v_status <> 'completed' then
    raise exception 'CHECK 5 FAILED: expected completed, got %', v_status;
  end if;
  raise notice 'CHECK 5 ok  — league completes once every final has a result';

  -- ── 6. A division that never reached knockout blocks completion ───────────
  insert into public.leagues (name, status, divisions)
  values ('LEAGUE LIFECYCLE TEST 2', 'knockout', array['mens'])
  returning id into v_other;
  insert into public.league_teams
    (league_id, division, player1_id, player2_id, experience_level, group_label)
  values
    (v_other, 'mens', v_players[1], v_players[2], 'beginner', 'A'),
    (v_other, 'mens', v_players[3], v_players[4], 'beginner', 'A');
  insert into public.league_matches (league_id, division, stage, team1_id, team2_id, winner_id)
  select v_other, 'mens', 'group', t[1], t[2], t[1]
    from (select array_agg(id) t from public.league_teams where league_id = v_other) x;
  begin
    perform public.admin_update_league_status(v_other, 'completed');
    raise exception 'CHECK 6 FAILED: completed a league with no knockout bracket';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'every final needs a result%' then raise; end if;
  end;
  raise notice 'CHECK 6 ok  — group-only division blocks completion';

end $$;

-- ── Lifecycle: publish, readiness, edit, delete ─────────────────────────────
do $$
declare
  v_league uuid;
  v_players uuid[];
  v_teams uuid[];
  v_err text;
  v_status text;
  v_name text;

begin
  select array_agg(id order by name) into v_players
    from public.players where name like 'League Test P%';

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_players[1], 'app_metadata', json_build_object('role', 'admin'))::text,
    true
  );

  v_league := (public.admin_create_league(jsonb_build_object('name', 'LIFECYCLE DRAFT', 'divisions', jsonb_build_array('mens')))).id;
  if (select published_at from public.leagues where id = v_league) is not null then
    raise exception 'CHECK 7 FAILED: a new league was published on creation';
  end if;
  raise notice 'CHECK 7 ok  — new leagues start hidden';

  -- 8. Skipping a phase is refused
  begin
    perform public.admin_update_league_status(v_league, 'knockout');
    raise exception 'CHECK 8 FAILED: draft jumped straight to knockout';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'status must advance one phase at a time' then raise; end if;
  end;
  raise notice 'CHECK 8 ok  — phases advance one step at a time';

  -- 9. Group stage needs publishing, then fixtures
  begin
    perform public.admin_update_league_status(v_league, 'group_stage');
    raise exception 'CHECK 9 FAILED: hidden draft started its group stage';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'publish the season%' then raise; end if;
  end;
  perform public.admin_set_league_published(v_league, true);

  with ins as (
    insert into public.league_teams
      (league_id, division, player1_id, player2_id, experience_level, team_name, group_label)
    select v_league, 'mens', v_players[g * 2 - 1], v_players[g * 2], 'beginner', 'L' || g,
           case when g <= 2 then 'A' else 'B' end
      from generate_series(1, 4) g
    returning id, team_name
  )
  select array_agg(id order by team_name) into v_teams from ins;

  begin
    perform public.admin_update_league_status(v_league, 'group_stage');
    raise exception 'CHECK 9 FAILED: group stage started without fixtures';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'every division with teams needs groups%' then raise; end if;
  end;

  insert into public.league_matches (league_id, division, stage, team1_id, team2_id)
  values (v_league, 'mens', 'group', v_teams[1], v_teams[2]),
         (v_league, 'mens', 'group', v_teams[3], v_teams[4]);
  perform public.admin_update_league_status(v_league, 'group_stage');
  raise notice 'CHECK 9 ok  — group stage needs publishing and fixtures';

  -- 10. Knockout needs a bracket
  begin
    perform public.admin_update_league_status(v_league, 'knockout');
    raise exception 'CHECK 10 FAILED: knockout started without a bracket';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'every division needs its knockout bracket%' then raise; end if;
  end;
  insert into public.league_matches (league_id, division, stage, team1_id, team2_id)
  values (v_league, 'mens', 'gold_semi', v_teams[1], v_teams[4]),
         (v_league, 'mens', 'gold_semi', v_teams[3], v_teams[2]);
  perform public.admin_update_league_status(v_league, 'knockout');
  raise notice 'CHECK 10 ok — knockout needs a bracket';

  -- 11. Past draft: cannot hide, cannot change divisions, cannot delete
  begin
    perform public.admin_set_league_published(v_league, false);
    raise exception 'CHECK 11 FAILED: hid a season past draft';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'only a draft season can be hidden' then raise; end if;
  end;
  begin
    perform public.admin_update_league(v_league, jsonb_build_object('name', 'X', 'divisions', jsonb_build_array('mens', 'womens')));
    raise exception 'CHECK 11 FAILED: changed divisions past draft';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err not like 'divisions can only change%' then raise; end if;
  end;
  begin
    perform public.admin_delete_league(v_league);
    raise exception 'CHECK 11 FAILED: deleted a season past draft';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'only a draft season can be deleted' then raise; end if;
  end;
  perform public.admin_update_league(v_league, jsonb_build_object('name', '  Renamed Season  ', 'divisions', jsonb_build_array('mens')));
  select name into v_name from public.leagues where id = v_league;
  if v_name <> 'Renamed Season' then
    raise exception 'CHECK 11 FAILED: expected rename, got %', v_name;
  end if;
  raise notice 'CHECK 11 ok — past draft: name editable, hide/divisions/delete refused';

  -- 12. Draft edits and delete
  v_league := (public.admin_create_league(jsonb_build_object('name', 'LIFECYCLE DRAFT 2', 'divisions', jsonb_build_array('mens', 'womens')))).id;
  insert into public.league_teams (league_id, division, player1_id, player2_id, experience_level)
  values (v_league, 'womens', v_players[9], v_players[10], 'beginner');
  begin
    perform public.admin_update_league(v_league, jsonb_build_object('name', 'X', 'divisions', jsonb_build_array('mens')));
    raise exception 'CHECK 12 FAILED: removed a division that has teams';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'cannot remove a division that has teams' then raise; end if;
  end;
  perform public.admin_update_league(v_league, jsonb_build_object('name', 'X', 'divisions', jsonb_build_array('womens')));
  insert into public.league_matches (league_id, division, stage, team1_id)
  select v_league, 'womens', 'group', id from public.league_teams where league_id = v_league;
  begin
    perform public.admin_delete_league(v_league);
    raise exception 'CHECK 12 FAILED: deleted a draft with matches';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'cannot delete a season that has matches' then raise; end if;
  end;
  delete from public.league_matches where league_id = v_league;
  perform public.admin_delete_league(v_league);
  if exists (select 1 from public.leagues where id = v_league)
     or exists (select 1 from public.league_teams where league_id = v_league) then
    raise exception 'CHECK 12 FAILED: draft or its teams survived delete';
  end if;
  raise notice 'CHECK 12 ok — draft divisions editable within limits; empty draft deletes with its teams';
end $$;

-- ── Visibility: hidden leagues are invisible to non-admins ──────────────────
do $$
declare
  v_hidden uuid;
  v_published uuid;
  v_players uuid[];
  v_count int;
begin
  select array_agg(id order by name) into v_players
    from public.players where name like 'League Test P%';

  insert into public.leagues (name, status, divisions) values ('HIDDEN LEAGUE', 'draft', array['mens'])
  returning id into v_hidden;
  insert into public.leagues (name, status, divisions, published_at) values ('PUBLISHED LEAGUE', 'draft', array['mens'], now())
  returning id into v_published;
  insert into public.league_teams (league_id, division, player1_id, player2_id, experience_level)
  values (v_hidden, 'mens', v_players[1], v_players[2], 'beginner'),
         (v_published, 'mens', v_players[1], v_players[2], 'beginner');
  insert into public.league_matches (league_id, division, stage, team1_id)
  select league_id, 'mens', 'group', id from public.league_teams where league_id in (v_hidden, v_published);

  -- anon
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into v_count from public.leagues where id in (v_hidden, v_published);
  if v_count <> 1 then raise exception 'CHECK 13 FAILED: anon sees % of the 2 leagues', v_count; end if;
  select count(*) into v_count from public.league_teams where league_id = v_hidden;
  if v_count <> 0 then raise exception 'CHECK 13 FAILED: anon sees hidden teams'; end if;
  select count(*) into v_count from public.league_matches where league_id = v_hidden;
  if v_count <> 0 then raise exception 'CHECK 13 FAILED: anon sees hidden matches'; end if;
  select count(*) into v_count from public.league_teams where league_id = v_published;
  if v_count <> 1 then raise exception 'CHECK 13 FAILED: anon cannot see published teams'; end if;
  execute 'reset role';

  -- signed-in player
  perform set_config('request.jwt.claims', json_build_object('sub', v_players[3], 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.leagues where id = v_hidden;
  if v_count <> 0 then raise exception 'CHECK 13 FAILED: player sees the hidden league'; end if;
  select count(*) into v_count from public.league_matches where league_id = v_hidden;
  if v_count <> 0 then raise exception 'CHECK 13 FAILED: player sees hidden matches'; end if;
  execute 'reset role';

  -- admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_players[1], 'role', 'authenticated', 'app_metadata', json_build_object('role', 'admin'))::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.league_matches where league_id = v_hidden;
  if v_count <> 1 then raise exception 'CHECK 13 FAILED: admin cannot see hidden matches'; end if;
  execute 'reset role';

  raise notice 'CHECK 13 ok — hidden leagues, teams and matches are invisible to anon and players, visible to admins';
  raise notice '';
  raise notice 'All league lifecycle checks passed.';
end $$;

rollback;
