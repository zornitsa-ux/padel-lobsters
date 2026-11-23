-- Levelling: drop the step 6 prefill (docs/signup-revamp DESIGN §2.2, C-2, C-3).
--
-- Since D-16 only players with no level take the six-step flow, so step 6
-- never opens with a level on file and `prefilled` is always false.
-- complete_levelling no longer reads or stores it; a `prefilled` key from an
-- older client is ignored like any other extra key. get_my_levelling keeps
-- returning the level on file, so open older clients still parse it.

CREATE OR REPLACE FUNCTION public.complete_levelling(input_answers jsonb)
 RETURNS TABLE(status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_player_id   uuid := auth.uid();
  v_level       numeric;
  v_old_level   numeric;
  v_old_mm      numeric;
  v_old_sigma   numeric;
  v_source      text;
  v_start_mu    numeric;
  v_start_sigma numeric;
  v_played      boolean;
begin
  set local statement_timeout = '30s';
  if v_player_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if jsonb_typeof(input_answers) is distinct from 'object'
     or jsonb_typeof(coalesce(input_answers -> 'playtomic_level', 'null')) not in ('number', 'null') then
    return query select 'invalid_answers'::text; return;
  end if;
  if jsonb_typeof(input_answers -> 'playtomic_level') = 'number' then
    begin
      v_level := private.level_to_store(input_answers ->> 'playtomic_level', 'required');
    exception when raise_exception then
      return query select 'invalid_level'::text; return;
    end;
  end if;

  -- The row lock serialises a double tap: the second call sees the first's
  -- levelling row and returns already_levelled.
  select p.playtomic_level, p.mm_rating, p.mm_sigma
    into v_old_level, v_old_mm, v_old_sigma
    from public.players p where p.id = v_player_id
   for update;
  if not found then
    return query select 'not_needed'::text; return;
  end if;

  if not private.needs_levelling(v_player_id) then
    if exists (select 1 from public.player_levelling l where l.player_id = v_player_id) then
      return query select 'already_levelled'::text; return;
    end if;
    begin
      insert into public.player_levelling (
        player_id, years_playing, frequency, lessons, racket_sports, walls,
        playtomic_level, start_source, start_mu, start_sigma
      ) values (
        v_player_id,
        input_answers ->> 'years_playing',
        input_answers ->> 'frequency',
        input_answers ->> 'lessons',
        input_answers ->> 'racket_sports',
        input_answers ->> 'walls',
        case when private.has_level(v_old_level) then v_old_level end,
        'none', null, null
      );
    exception when check_violation or not_null_violation then
      return query select 'invalid_answers'::text; return;
    end;
    return query select 'ok'::text; return;
  end if;

  -- No level but a played night (an admin cleared it, or a captain-added
  -- partner played): the answers and any level are stored, the learned
  -- rating is kept.
  v_played := private.has_played_night(v_player_id);

  -- Walls start (C-1): 1.0 / 1.5 / 2.0 / 2.5. LEVELLING_CAP 3.0 only bites if
  -- an answer-based start ever goes higher; Playtomic is taken as entered (D-4).
  if v_level is not null then
    v_source := 'playtomic';
    v_start_mu := v_level;
    v_start_sigma := 0.7;
  else
    v_source := 'walls';
    v_start_mu := least(3.0, case input_answers ->> 'walls'
                               when 'lets_go'               then 1.0
                               when 'slow_back_wall'        then 1.5
                               when 'back_wall_not_corners' then 2.0
                               when 'corners'               then 2.5
                             end);
    v_start_sigma := 1.0;
  end if;

  begin
    insert into public.player_levelling (
      player_id, years_playing, frequency, lessons, racket_sports, walls,
      playtomic_level, start_source, start_mu, start_sigma
    ) values (
      v_player_id,
      input_answers ->> 'years_playing',
      input_answers ->> 'frequency',
      input_answers ->> 'lessons',
      input_answers ->> 'racket_sports',
      input_answers ->> 'walls',
      v_level, v_source, v_start_mu, v_start_sigma
    )
    on conflict (player_id) do update set
      years_playing   = excluded.years_playing,
      frequency       = excluded.frequency,
      lessons         = excluded.lessons,
      racket_sports   = excluded.racket_sports,
      walls           = excluded.walls,
      playtomic_level = excluded.playtomic_level,
      start_source    = excluded.start_source,
      start_mu        = excluded.start_mu,
      start_sigma     = excluded.start_sigma,
      completed_at    = now();
  exception when check_violation or not_null_violation then
    return query select 'invalid_answers'::text; return;
  end;

  if v_played then
    update public.players p set
      playtomic_level      = coalesce(v_level, p.playtomic_level),
      playtomic_updated_at = case when v_level is not null then now() else p.playtomic_updated_at end
    where p.id = v_player_id;
    return query select 'ok'::text; return;
  end if;

  update public.players p set
    mm_rating            = v_start_mu,
    mm_sigma             = v_start_sigma,
    mm_rating_updated_at = now(),
    playtomic_level      = coalesce(v_level, p.playtomic_level),
    playtomic_updated_at = case when v_level is not null then now() else p.playtomic_updated_at end
  where p.id = v_player_id;

  -- Unflagged, so the admin review queue (which parses breakdown as an array)
  -- never reads it.
  insert into public.rating_events (
    kind, tournament_id, player_id, prior_mu, prior_sigma,
    proposed_delta, applied_delta, flagged, review_status, breakdown
  ) values (
    'levelling', null, v_player_id,
    coalesce(v_old_mm, v_old_level, 0), coalesce(v_old_sigma, 0.7),
    0, v_start_mu - coalesce(v_old_mm, v_old_level, 0), false, null,
    jsonb_build_object('source', v_source)
  );

  return query select 'ok'::text;
end
$function$;

alter table public.player_levelling drop column prefilled;
