-- ============================================================================
-- Levelling storage and RPCs (20261112120000, docs/signup-revamp/ S1).
--
-- Plain script in one transaction that rolls back. Callers are faked through
-- request.jwt.claims, which auth.uid() and auth.jwt() read. The double-tap
-- race is in levelling_parallel.sh.
--
--   npm run db:test
-- ============================================================================

begin;

set local client_min_messages = notice;

create function pg_temp.act_as(input_player_id uuid, input_role text default 'member')
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', input_player_id,
                      'app_metadata', json_build_object('role', input_role))::text, true);
$$;

create function pg_temp.answers(input_walls text default 'lets_go', input_level numeric default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'years_playing', 'under_1y', 'frequency', 'few_per_month', 'lessons', 'none',
    'racket_sports', 'casual', 'walls', input_walls,
    'playtomic_level', input_level, 'prefilled', false);
$$;

create function pg_temp.complete(input_player_id uuid, input_answers jsonb)
returns text language sql as $$
  select pg_temp.act_as(input_player_id);
  select status from public.complete_levelling(input_answers);
$$;

create function pg_temp.check(input_ok boolean, input_label text)
returns void language plpgsql as $$
begin
  if input_ok is distinct from true then
    raise exception 'FAILED: %', input_label;
  end if;
end $$;

do $$
declare
  v_done uuid;      -- completed individual event
  v_team_t uuid;    -- completed team event
  v_p uuid[];
  v_team uuid;
  v_status text;
  v_row record;
  v_err text;
  v_count integer;
begin
  perform set_config('app.audit_source', 'test_fixture', true);

  insert into public.tournaments (name, date, time, max_players, status)
  values ('LEVELLING DONE', current_date - 7, '18:00', 8, 'completed')
  returning id into v_done;
  insert into public.tournaments (name, date, time, max_players, status, entry_mode, format)
  values ('LEVELLING TEAM', current_date - 7, '18:00', 8, 'completed', 'team', 'king_of_court')
  returning id into v_team_t;

  -- 1 none · 2 seed · 3 tournament · 4 self_reset only · 5 team-event captain
  -- 6 team-event partner · 7 cancelled only · 8–11 walls answers
  -- 12 Playtomic 1.0 · 13 Playtomic 6.5 · 14 admin
  with ins as (
    insert into public.players (name, status, playtomic_level, adjusted_level)
    select 'Levelling Test P' || lpad(g::text, 2, '0'), 'active',
           case g when 1 then 2.3 when 4 then 2.0 else 0 end,
           case g when 1 then 2.3 when 4 then 2.0 else 0 end
      from generate_series(1, 14) g
    returning id, name
  )
  select array_agg(id order by name) into v_p from ins;

  insert into public.rating_events (kind, player_id, prior_mu, prior_sigma, proposed_delta, applied_delta, breakdown)
  values ('seed',       v_p[2], 2, 0.7, 0, 0, '[]'),
         ('tournament', v_p[3], 2, 0.7, 0, 0, '[]'),
         ('self_reset', v_p[4], 1, 0.7, 0, 1, '[]');
  update public.players set mm_rating = 2.0, mm_sigma = 0.7 where id = v_p[4];

  insert into public.event_teams (tournament_id, captain_id) values (v_team_t, v_p[5])
  returning id into v_team;
  insert into public.registrations (tournament_id, player_id, status, team_id)
  values (v_team_t, v_p[5], 'registered', v_team), (v_team_t, v_p[6], 'registered', v_team);
  insert into public.registrations (tournament_id, player_id, status)
  values (v_done, v_p[7], 'cancelled');

  -- ── 1. needs_levelling ────────────────────────────────────────────────────
  perform pg_temp.check(private.needs_levelling(v_p[1]), '1a: no history needs levelling');
  perform pg_temp.check(not private.needs_levelling(v_p[2]), '1b: seed row is a played night');
  perform pg_temp.check(not private.needs_levelling(v_p[3]), '1c: tournament row is a played night');
  perform pg_temp.check(private.needs_levelling(v_p[4]), '1d: self_reset only still needs levelling');
  perform pg_temp.check(not private.needs_levelling(v_p[5]), '1e: completed team event (captain)');
  perform pg_temp.check(not private.needs_levelling(v_p[6]), '1f: completed team event (partner)');
  perform pg_temp.check(private.needs_levelling(v_p[7]), '1g: a cancelled row is not a played night');
  raise notice 'CHECK 1 ok: needs_levelling';

  -- ── 2. get_my_levelling ───────────────────────────────────────────────────
  perform pg_temp.act_as(v_p[1]);
  select * into v_row from public.get_my_levelling();
  perform pg_temp.check(v_row.needs_levelling and v_row.playtomic_level = 2.3, '2a: prefill level');
  perform pg_temp.act_as(v_p[8]);
  select * into v_row from public.get_my_levelling();
  perform pg_temp.check(v_row.needs_levelling and v_row.playtomic_level is null, '2b: level 0 is no prefill');
  perform pg_temp.act_as(v_p[2]);
  select * into v_row from public.get_my_levelling();
  perform pg_temp.check(not v_row.needs_levelling, '2c: played night');
  perform pg_temp.act_as(gen_random_uuid());
  select * into v_row from public.get_my_levelling();
  perform pg_temp.check(not v_row.needs_levelling and v_row.playtomic_level is null, '2d: no player row');
  raise notice 'CHECK 2 ok: get_my_levelling';

  -- ── 3. Signed out ─────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '', true);
  foreach v_status in array array['complete', 'get'] loop
    v_err := null;
    begin
      if v_status = 'complete' then
        perform public.complete_levelling(pg_temp.answers());
      else
        perform public.get_my_levelling();
      end if;
    exception when sqlstate 'P0001' then v_err := sqlerrm;
    end;
    perform pg_temp.check(v_err = 'not_authenticated', '3: ' || v_status || ' signed out raises');
  end loop;
  raise notice 'CHECK 3 ok: not_authenticated';

  -- ── 4. invalid_answers writes nothing ─────────────────────────────────────
  perform pg_temp.check(pg_temp.complete(v_p[1], '[]') = 'invalid_answers', '4a: not an object');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers() - 'lessons') = 'invalid_answers', '4b: missing key');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers('sometimes')) = 'invalid_answers', '4c: unknown code');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers(input_level => 0)) = 'invalid_answers', '4d: level 0');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers(input_level => 7.5)) = 'invalid_answers', '4e: level over 7');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers() || '{"playtomic_level": "2"}') = 'invalid_answers', '4f: level as text');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers() || '{"prefilled": "yes"}') = 'invalid_answers', '4g: prefilled as text');
  perform pg_temp.check(pg_temp.complete(v_p[1], pg_temp.answers() || '{"walls": 2}') = 'invalid_answers', '4h: code as number');
  perform pg_temp.check(
    not exists (select 1 from public.player_levelling where player_id = v_p[1])
    and not exists (select 1 from public.rating_events where player_id = v_p[1])
    and (select mm_rating from public.players where id = v_p[1]) is null,
    '4: nothing written');
  raise notice 'CHECK 4 ok: invalid_answers';

  -- ── 5. Walls start: 1.0 / 1.5 / 2.0 / 2.5, σ 1.0, level untouched ─────────
  perform pg_temp.check(pg_temp.complete(v_p[8],  pg_temp.answers('lets_go')) = 'ok', '5a');
  perform pg_temp.check(pg_temp.complete(v_p[9],  pg_temp.answers('slow_back_wall')) = 'ok', '5b');
  perform pg_temp.check(pg_temp.complete(v_p[10], pg_temp.answers('back_wall_not_corners')) = 'ok', '5c');
  perform pg_temp.check(pg_temp.complete(v_p[11], pg_temp.answers('corners')) = 'ok', '5d');
  perform pg_temp.check(
    (select array_agg(p.mm_rating order by p.name) from public.players p where p.id = any(v_p[8:11]))
      = array[1.0, 1.5, 2.0, 2.5]::numeric[],
    '5e: walls starts');
  perform pg_temp.check(
    (select bool_and(p.mm_sigma = 1.0 and p.playtomic_level = 0 and p.adjusted_level = 0
                     and p.mm_rating_updated_at is not null and p.mm_rating <= 3.0)
       from public.players p where p.id = any(v_p[8:11])),
    '5f: σ 1.0, level unchanged, within the 3.0 cap');
  select * into v_row from public.player_levelling where player_id = v_p[11];
  perform pg_temp.check(
    v_row.start_source = 'walls' and v_row.start_mu = 2.5 and v_row.start_sigma = 1.0
    and v_row.playtomic_level is null and v_row.walls = 'corners' and v_row.years_playing = 'under_1y'
    and not v_row.prefilled,
    '5g: stored answers');
  select * into v_row from public.rating_events where player_id = v_p[11];
  perform pg_temp.check(
    v_row.kind = 'levelling' and v_row.tournament_id is null and v_row.prior_mu = 0
    and v_row.prior_sigma = 0.7 and v_row.proposed_delta = 0 and v_row.applied_delta = 2.5
    and not v_row.flagged and v_row.breakdown = '{"source": "walls"}',
    '5h: audit row');
  raise notice 'CHECK 5 ok: walls starts';

  -- ── 6. Playtomic start: as entered, σ 0.7, no cap ─────────────────────────
  perform pg_temp.check(
    pg_temp.complete(v_p[12], pg_temp.answers('corners', 1.0) || '{"prefilled": true}') = 'ok', '6a');
  perform pg_temp.check(pg_temp.complete(v_p[13], pg_temp.answers('lets_go', 6.5)) = 'ok', '6b');
  select * into v_row from public.players where id = v_p[12];
  perform pg_temp.check(
    v_row.mm_rating = 1.0 and v_row.mm_sigma = 0.7 and v_row.playtomic_level = 1.0
    and v_row.adjusted_level = 1.0 and v_row.playtomic_updated_at is not null,
    '6c: 1.0 taken as entered, profile level set');
  perform pg_temp.check(
    (select mm_rating = 6.5 from public.players where id = v_p[13]), '6d: no cap on Playtomic');
  select * into v_row from public.player_levelling where player_id = v_p[12];
  perform pg_temp.check(
    v_row.start_source = 'playtomic' and v_row.playtomic_level = 1.0 and v_row.prefilled,
    '6e: stored with prefilled');
  perform pg_temp.check(
    (select breakdown = '{"source": "playtomic"}' from public.rating_events where player_id = v_p[12]),
    '6f: audit source');
  raise notice 'CHECK 6 ok: Playtomic starts';

  -- ── 7. Overwrites a self_reset start; audit keeps the prior ───────────────
  perform pg_temp.check(pg_temp.complete(v_p[4], pg_temp.answers('slow_back_wall')) = 'ok', '7a');
  select * into v_row from public.rating_events where player_id = v_p[4] and kind = 'levelling';
  perform pg_temp.check(
    v_row.prior_mu = 2.0 and v_row.prior_sigma = 0.7 and v_row.applied_delta = -0.5, '7b: prior kept');
  perform pg_temp.check(
    (select mm_rating = 1.5 and playtomic_level = 2.0 from public.players where id = v_p[4]),
    '7c: start overwritten, profile level kept');
  raise notice 'CHECK 7 ok: self_reset overwritten';

  -- ── 8. already_levelled, not_needed ───────────────────────────────────────
  perform pg_temp.check(pg_temp.complete(v_p[8], pg_temp.answers('corners')) = 'already_levelled', '8a');
  perform pg_temp.check(
    (select count(*) from public.rating_events where player_id = v_p[8]) = 1
    and (select mm_rating = 1.0 from public.players where id = v_p[8]),
    '8b: second call writes nothing');
  perform pg_temp.check(pg_temp.complete(v_p[2], pg_temp.answers()) = 'not_needed', '8c: seed');
  perform pg_temp.check(pg_temp.complete(v_p[5], pg_temp.answers()) = 'not_needed', '8d: team event');
  perform pg_temp.check(pg_temp.complete(gen_random_uuid(), pg_temp.answers()) = 'not_needed', '8e: no player row');
  perform pg_temp.check(
    not exists (select 1 from public.player_levelling where player_id in (v_p[2], v_p[5])),
    '8f: nothing stored');
  raise notice 'CHECK 8 ok: already_levelled / not_needed';

  -- ── 9. Reset guard in update_my_profile (C-7) ─────────────────────────────
  -- Levelled, no played night: the profile level changes, the start stands.
  perform pg_temp.act_as(v_p[8]);
  perform public.update_my_profile('{"playtomic_level": 3.1}');
  perform pg_temp.check(
    (select playtomic_level = 3.1 and mm_rating = 1.0 from public.players where id = v_p[8])
    and not exists (select 1 from public.rating_events where player_id = v_p[8] and kind = 'self_reset'),
    '9a: levelled start stands');

  -- Not levelled: today's reset.
  perform pg_temp.act_as(v_p[1]);
  perform public.update_my_profile('{"playtomic_level": 2.8}');
  perform pg_temp.check(
    (select mm_rating = 2.8 and mm_sigma = 0.7 from public.players where id = v_p[1])
    and exists (select 1 from public.rating_events where player_id = v_p[1] and kind = 'self_reset'),
    '9b: unlevelled player resets');

  -- Clearing the level never resets to 0.
  perform public.update_my_profile('{"playtomic_level": 0}');
  perform pg_temp.check(
    (select playtomic_level = 0 and mm_rating = 2.8 from public.players where id = v_p[1])
    and (select count(*) from public.rating_events where player_id = v_p[1] and kind = 'self_reset') = 1,
    '9c: no reset to 0');

  -- Levelled with a played night since: today's reset.
  insert into public.rating_events (kind, player_id, prior_mu, prior_sigma, proposed_delta, applied_delta, breakdown)
  values ('tournament', v_p[9], 1.5, 1.0, 0.2, 0.2, '[]');
  perform pg_temp.act_as(v_p[9]);
  perform public.update_my_profile('{"playtomic_level": 2.4}');
  perform pg_temp.check(
    (select mm_rating = 2.4 from public.players where id = v_p[9]),
    '9d: played night resets');
  -- A null level and no mm_rating: the prior falls back to 0 (prior_mu is NOT NULL).
  update public.players set playtomic_level = null where id = v_p[7];
  perform pg_temp.act_as(v_p[7]);
  perform public.update_my_profile('{"playtomic_level": 2.0}');
  perform pg_temp.check(
    (select prior_mu = 0 from public.rating_events where player_id = v_p[7] and kind = 'self_reset'),
    '9e: null prior');

  perform pg_temp.check(private.levelling_start_stands(v_p[8]), '9f: levelled, no night');
  perform pg_temp.check(not private.levelling_start_stands(v_p[9]), '9g: levelled, played since');
  perform pg_temp.check(not private.levelling_start_stands(v_p[1]), '9h: not levelled');
  raise notice 'CHECK 9 ok: reset guard';

  -- ── 10. RLS: members read no levelling row, not even their own ───────────
  perform pg_temp.act_as(v_p[8]);
  set local role authenticated;
  select count(*) into v_count from public.player_levelling;
  reset role;
  perform pg_temp.check(v_count = 0, '10a: member reads nothing');

  perform pg_temp.act_as(v_p[14], 'admin');
  set local role authenticated;
  select count(*) into v_count from public.player_levelling where player_id = any(v_p);
  reset role;
  perform pg_temp.check(v_count = 7, '10b: admin reads all (' || v_count || ')');

  v_err := null;
  perform pg_temp.act_as(v_p[1]);
  set local role authenticated;
  begin
    insert into public.player_levelling (player_id, years_playing, frequency, lessons, racket_sports,
                                         walls, start_source, start_mu, start_sigma)
    values (v_p[1], 'under_1y', 'few_per_month', 'none', 'none', 'corners', 'walls', 3, 1);
  exception when insufficient_privilege then v_err := 'denied';
  end;
  reset role;
  perform pg_temp.check(v_err = 'denied', '10c: no direct write');

  set local role authenticated;
  v_err := null;
  begin
    perform private.needs_levelling(v_p[1]);
  exception when insufficient_privilege then v_err := 'denied';
  end;
  reset role;
  perform pg_temp.check(v_err = 'denied', '10d: private helpers closed');
  raise notice 'CHECK 10 ok: RLS and grants';

  raise notice 'levelling: all checks passed';
end $$;

rollback;
