-- ============================================================================
-- Signup revamp S3b: the gate is "is a level recorded" (DECISIONS D-16).
--
-- A player needs levelling only when they have no Playtomic level on file and
-- no levelling start. Playing a night no longer enters into it: players who
-- already have a level are never gated. The registration RPCs, the backstop
-- trigger, get_my_levelling and complete_levelling all read this one function.
-- ============================================================================

create or replace function private.needs_levelling(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select not exists (
           select 1 from public.players p
            where p.id = input_player_id and coalesce(p.playtomic_level, 0) > 0)
     and not exists (
           select 1 from public.player_levelling l where l.player_id = input_player_id);
$function$;

revoke all on function private.needs_levelling(uuid) from public, anon, authenticated;

-- complete_levelling: re-created from 20261112120000_levelling.sql. Only a
-- player the gate holds may level, so a player with a level can't re-seed
-- their rating, and a gated player who has played a night can still level.
create or replace function public.complete_levelling(input_answers jsonb)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
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
     or jsonb_typeof(coalesce(input_answers -> 'playtomic_level', 'null')) not in ('number', 'null')
     or jsonb_typeof(coalesce(input_answers -> 'prefilled', 'false')) <> 'boolean' then
    return query select 'invalid_answers'::text; return;
  end if;
  v_level := (input_answers ->> 'playtomic_level')::numeric;

  -- The row lock serialises a double tap: the second call sees the first's
  -- levelling row and returns already_levelled.
  select p.playtomic_level, p.mm_rating, p.mm_sigma
    into v_old_level, v_old_mm, v_old_sigma
    from public.players p where p.id = v_player_id
   for update;
  if not found then
    return query select 'not_needed'::text; return;
  end if;
  if exists (select 1 from public.player_levelling l where l.player_id = v_player_id) then
    return query select 'already_levelled'::text; return;
  end if;
  if not private.needs_levelling(v_player_id) then
    return query select 'not_needed'::text; return;
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
      playtomic_level, start_source, start_mu, start_sigma, prefilled
    ) values (
      v_player_id,
      input_answers ->> 'years_playing',
      input_answers ->> 'frequency',
      input_answers ->> 'lessons',
      input_answers ->> 'racket_sports',
      input_answers ->> 'walls',
      v_level, v_source, v_start_mu, v_start_sigma,
      coalesce((input_answers ->> 'prefilled')::boolean, false)
    );
  exception when check_violation or not_null_violation then
    return query select 'invalid_answers'::text; return;
  end;

  if v_played then
    update public.players p set
      playtomic_level      = coalesce(v_level, p.playtomic_level),
      adjusted_level       = coalesce(v_level, p.adjusted_level),
      playtomic_updated_at = case when v_level is not null then now() else p.playtomic_updated_at end
    where p.id = v_player_id;
    return query select 'ok'::text; return;
  end if;

  update public.players p set
    mm_rating            = v_start_mu,
    mm_sigma             = v_start_sigma,
    mm_rating_updated_at = now(),
    playtomic_level      = coalesce(v_level, p.playtomic_level),
    adjusted_level       = coalesce(v_level, p.adjusted_level),
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
