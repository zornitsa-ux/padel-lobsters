-- ============================================================================
-- Signup revamp S3c: the five questions for players who already have a level
-- (DECISIONS D-16, docs/signup-revamp/).
--
-- A player with a level answers the questions from a Home prompt that never
-- gates anything. complete_levelling stores the answers with start_source
-- 'none' and leaves the rating alone; get_my_levelling says whether the prompt
-- is open. Only a real start (playtomic / walls) counts as a level recorded
-- for the gate and as a start that stands for the reset guard (C-7).
-- ============================================================================

-- ── 1. player_levelling: answers-only rows (C-2) ───────────────────────────
alter table public.player_levelling
  drop constraint player_levelling_start_source_check,
  add constraint player_levelling_start_source_check
    check (start_source in ('playtomic', 'walls', 'none')),
  alter column start_mu drop not null,
  alter column start_sigma drop not null,
  add constraint player_levelling_start_present
    check ((start_source = 'none') = (start_mu is null)
       and (start_source = 'none') = (start_sigma is null));

comment on column public.player_levelling.playtomic_level is
  'Level entered at the Playtomic step; for start_source none, the level on file when answering';

-- ── 2. Only a real start counts ─────────────────────────────────────────────
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
           select 1 from public.player_levelling l
            where l.player_id = input_player_id and l.start_source <> 'none');
$function$;

create or replace function private.levelling_start_stands(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
           select 1 from public.player_levelling l
            where l.player_id = input_player_id and l.start_source <> 'none')
     and not private.has_played_night(input_player_id);
$function$;

revoke all on function private.needs_levelling(uuid) from public, anon, authenticated;
revoke all on function private.levelling_start_stands(uuid) from public, anon, authenticated;

-- ── 3. complete_levelling (C-3) ─────────────────────────────────────────────
-- Re-created from 20261116180000_level_gate.sql. A gated caller sets a start
-- as before, replacing an answers-only row if they cleared their level after
-- answering. Anyone else answers once: the answers are stored, the rating and
-- profile level are not touched, and any Playtomic value sent is ignored.
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

  if not private.needs_levelling(v_player_id) then
    if exists (select 1 from public.player_levelling l where l.player_id = v_player_id) then
      return query select 'already_levelled'::text; return;
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
        nullif(v_old_level, 0), 'none', null, null, false
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
      prefilled       = excluded.prefilled,
      completed_at    = now();
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

-- ── 4. get_my_levelling: adds questions_open (C-3) ──────────────────────────
-- The return type changes, so drop and re-create; grants are re-issued below.
drop function public.get_my_levelling();

create function public.get_my_levelling()
returns table(needs_levelling boolean, playtomic_level numeric, questions_open boolean)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_player_id uuid := auth.uid();
begin
  set local statement_timeout = '30s';
  if v_player_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  return query
    select g.needs,
           case when p.playtomic_level > 0 then p.playtomic_level end,
           not g.needs and not exists (
             select 1 from public.player_levelling l where l.player_id = p.id)
      from public.players p
     cross join lateral (select private.needs_levelling(p.id) as needs) g
     where p.id = v_player_id;
  if not found then
    return query select false, null::numeric, false;
  end if;
end
$function$;

revoke execute on function public.get_my_levelling() from public, anon;
grant execute on function public.get_my_levelling() to authenticated;
