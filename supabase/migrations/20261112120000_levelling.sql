-- ============================================================================
-- Signup revamp S1: levelling storage and RPCs (docs/signup-revamp/).
--
-- A newcomer answers five placement questions and, optionally, gives a
-- Playtomic level. complete_levelling stores the answers and writes their
-- starting rating into mm_rating / mm_sigma, which the matcher already prefers
-- over the Playtomic prior. Nothing calls the RPCs until S2; the only
-- behaviour change here is the guard on update_my_profile's reset (C-7).
-- ============================================================================

-- ── 1. player_levelling (CONTRACTS C-1, C-2) ────────────────────────────────
-- Admin-read only, like rating_events. "Has levelled" is the row's existence.
create table public.player_levelling (
  player_id       uuid primary key references public.players(id) on delete cascade,
  years_playing   text not null check (years_playing in ('few_times', 'under_1y', '1_to_3y', 'over_3y')),
  frequency       text not null check (frequency in ('monthly_or_less', 'few_per_month', 'weekly_1_2', 'weekly_3_plus')),
  lessons         text not null check (lessons in ('none', '1_to_10', 'over_10')),
  racket_sports   text not null check (racket_sports in ('none', 'casual', 'regular', 'competitive')),
  walls           text not null check (walls in ('lets_go', 'slow_back_wall', 'back_wall_not_corners', 'corners')),
  playtomic_level numeric check (playtomic_level > 0 and playtomic_level <= 7),
  start_source    text not null check (start_source in ('playtomic', 'walls')),
  start_mu        numeric not null,
  start_sigma     numeric not null,
  prefilled       boolean not null default false,
  completed_at    timestamptz not null default now()
);

alter table public.player_levelling enable row level security;

create policy player_levelling_admin_read on public.player_levelling
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.player_levelling to authenticated;

comment on column public.rating_events.kind is
  'tournament | seed | self_reset | admin_edit | levelling (signup revamp C-4)';

-- ── 2. Who must level (DESIGN §2.1, D-2) ───────────────────────────────────
-- A played night: a tournament or seed rating event, or a registered row in a
-- completed tournament (team and King of the Court nights write no rating
-- events).
create or replace function private.has_played_night(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
           select 1 from public.rating_events e
            where e.player_id = input_player_id
              and e.kind in ('tournament', 'seed'))
      or exists (
           select 1 from public.registrations r
             join public.tournaments t on t.id = r.tournament_id
            where r.player_id = input_player_id
              and r.status = 'registered'
              and t.status = 'completed');
$function$;

create or replace function private.needs_levelling(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select not exists (select 1 from public.player_levelling l where l.player_id = input_player_id)
     and not private.has_played_night(input_player_id);
$function$;

-- A levelled player's start stands until their first played night (D-6).
create or replace function private.levelling_start_stands(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (select 1 from public.player_levelling l where l.player_id = input_player_id)
     and not private.has_played_night(input_player_id);
$function$;

revoke all on function private.has_played_night(uuid) from public, anon, authenticated;
revoke all on function private.needs_levelling(uuid) from public, anon, authenticated;
revoke all on function private.levelling_start_stands(uuid) from public, anon, authenticated;

-- ── 3. complete_levelling (C-3, DESIGN §2.3) ────────────────────────────────
-- The answer codes are checked by the table's CHECK constraints: an unknown or
-- missing code fails the insert and returns invalid_answers.
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
  if private.has_played_night(v_player_id) then
    return query select 'not_needed'::text; return;
  end if;

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

-- ── 4. get_my_levelling (C-3) ───────────────────────────────────────────────
create or replace function public.get_my_levelling()
returns table(needs_levelling boolean, playtomic_level numeric)
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
    select private.needs_levelling(p.id),
           case when p.playtomic_level > 0 then p.playtomic_level end
      from public.players p
     where p.id = v_player_id;
  if not found then
    return query select false, null::numeric;
  end if;
end
$function$;

revoke execute on function public.complete_levelling(jsonb) from public, anon;
revoke execute on function public.get_my_levelling() from public, anon;
grant execute on function public.complete_levelling(jsonb) to authenticated;
grant execute on function public.get_my_levelling() to authenticated;

-- ── 5. Reset guard in update_my_profile (C-7, D-6) ──────────────────────────
-- Re-created from 20260816140000_remove_device_trust.sql; only the
-- record_mm_reset call changes (its condition, and a 0 fallback for the prior). A levelled player's start stands until
-- their first played night, and clearing the level never resets to 0.
CREATE OR REPLACE FUNCTION public.update_my_profile(input_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_player_id     uuid;
  v_old_level     numeric;
  v_old_mm        numeric;
  v_old_sigma     numeric;
  v_new_level     numeric;
  v_level_changed boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL OR input_payload IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;

  SELECT playtomic_level, mm_rating, mm_sigma
    INTO v_old_level, v_old_mm, v_old_sigma
    FROM public.players WHERE id = v_player_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     AND v_new_level IS DISTINCT FROM v_old_level;

  UPDATE public.players p SET
    name               = CASE WHEN input_payload ? 'name'               THEN nullif(btrim(input_payload->>'name'), '')               ELSE p.name END,
    -- email is INTENTIONALLY OMITTED — self-service change routes through supabase.auth.updateUser.
    phone              = CASE WHEN input_payload ? 'phone'              THEN nullif(btrim(input_payload->>'phone'), '')              ELSE p.phone END,
    birthday           = CASE WHEN input_payload ? 'birthday'           THEN nullif(input_payload->>'birthday', '')::date            ELSE p.birthday END,
    country            = CASE WHEN input_payload ? 'country'            THEN nullif(btrim(input_payload->>'country'), '')            ELSE p.country END,
    gender             = CASE WHEN input_payload ? 'gender'             THEN nullif(btrim(input_payload->>'gender'), '')             ELSE p.gender END,
    is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
    preferred_position = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
    playtomic_level    = v_new_level,
    adjusted_level     = v_new_level,
    playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
    tagline            = CASE WHEN input_payload ? 'tagline'            THEN nullif(btrim(input_payload->>'tagline'), '')            ELSE p.tagline END,
    tagline_label      = CASE WHEN input_payload ? 'tagline_label'      THEN nullif(btrim(input_payload->>'tagline_label'), '')      ELSE p.tagline_label END,
    avatar_url         = CASE WHEN input_payload ? 'avatar_url'         THEN nullif(btrim(input_payload->>'avatar_url'), '')         ELSE p.avatar_url END,
    playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
  WHERE p.id = v_player_id;

  -- coalesce to 0: rating_events.prior_mu is NOT NULL and playtomic_level is nullable.
  IF v_level_changed
     AND v_new_level > 0
     AND NOT private.levelling_start_stands(v_player_id) THEN
    PERFORM public.record_mm_reset(
      v_player_id, v_new_level,
      coalesce(v_old_mm, v_old_level, 0), coalesce(v_old_sigma, 0.7), 'self_reset'
    );
  END IF;

  RETURN true;
END
$function$;
