-- "No level" stored as null (docs/signup-revamp S9, DESIGN §6.1, C-8), with
-- Matchmaking V2 M4.3's schema drop (docs/matchmaking-v2/PLAN.md, appendix):
-- both rewrite the same write paths and rebuild players_public.
--
-- - players.playtomic_level: null for no level (existing 0 → null), no default,
--   CHECK without the 0 branch. level_to_store returns null for no level.
-- - Dropped, with no reader or writer left: players.adjustment, adjusted_level,
--   learned_rating, learned_rd, learned_volatility, learned_matches_count,
--   learned_updated_at; tournaments.ratings_applied_at;
--   admin_persist_learned_ratings.
-- - Write paths below lose the dropped columns and are otherwise unchanged.

-- ── Legacy rating writer ────────────────────────────────────────────────────

drop function public.admin_persist_learned_ratings(jsonb, uuid[]);

-- ── players ─────────────────────────────────────────────────────────────────

drop view public.players_public;

alter table public.players
  drop constraint players_playtomic_level_range,
  alter column playtomic_level drop not null,
  alter column playtomic_level drop default;

update public.players set playtomic_level = null where playtomic_level = 0;

alter table public.players
  add constraint players_playtomic_level_range check (
    playtomic_level > 0
    and playtomic_level <= 7
    and playtomic_level = round(playtomic_level, 2)
  ),
  drop column adjustment,
  drop column adjusted_level,
  drop column learned_rating,
  drop column learned_rd,
  drop column learned_volatility,
  drop column learned_matches_count,
  drop column learned_updated_at;

alter table public.tournaments drop column ratings_applied_at;

create view public.players_public with (security_invoker = false) as
 SELECT id,
    name,
    status,
    gender,
    is_left_handed,
    preferred_position,
    country,
    tagline,
    tagline_label,
    playtomic_level,
    avatar_url,
    created_at,
        CASE
            WHEN (birthday IS NULL) THEN NULL::text
            ELSE to_char((birthday)::timestamp with time zone, 'MM-DD'::text)
        END AS birthday_md,
    (EXTRACT(month FROM birthday))::integer AS birthday_month,
    (EXTRACT(day FROM birthday))::integer AS birthday_day,
    role
   FROM players;

revoke all on public.players_public from anon, authenticated;
grant select on public.players_public to authenticated;

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function private.level_to_store(
  input_text text, input_policy text, input_recorded numeric default null
)
returns numeric
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_level numeric := private.parse_level(input_text);
begin
  if v_level is not null then
    return v_level;
  end if;
  case input_policy
    when 'optional' then
      return null;
    when 'required' then
      raise exception 'invalid_level' using errcode = 'P0001';
    when 'keep' then
      if private.has_level(input_recorded) then
        raise exception 'level_required' using errcode = 'P0001';
      end if;
      return null;
  end case;
end;
$$;

create or replace function private.needs_levelling(input_player_id uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select not exists (
           select 1 from public.players p
            where p.id = input_player_id and private.has_level(p.playtomic_level))
     and not exists (
           select 1 from public.player_levelling l
            where l.player_id = input_player_id and l.start_source <> 'none');
$$;

CREATE OR REPLACE FUNCTION public.get_my_levelling()
 RETURNS TABLE(needs_levelling boolean, playtomic_level numeric, questions_open boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_player_id uuid := auth.uid();
begin
  set local statement_timeout = '30s';
  if v_player_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  return query
    select g.needs,
           p.playtomic_level,
           not g.needs and not exists (
             select 1 from public.player_levelling l where l.player_id = p.id)
      from public.players p
     cross join lateral (select private.needs_levelling(p.id) as needs) g
     where p.id = v_player_id;
  if not found then
    return query select false, null::numeric, false;
  end if;
end
$function$

;

-- ── Write paths: without the dropped columns ────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_add_player(input_payload jsonb)
 RETURNS SETOF players
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  v_inserted public.players%rowtype;
  v_email    text := nullif(btrim(input_payload->>'email'), '');
  v_level    numeric;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_payload is null then return; end if;
  if v_email is not null and not private.is_valid_email(v_email) then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  v_level := private.level_to_store(input_payload->>'playtomic_level', 'optional');

  insert into public.players(name, email, phone, notes, playtomic_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
    preferred_position, tagline_label)
  values (
    coalesce(input_payload->>'name', ''),
    v_email,
    coalesce(input_payload->>'phone', ''),
    coalesce(input_payload->>'notes', ''),
    v_level,
    coalesce(input_payload->>'playtomic_username', ''),
    coalesce(input_payload->>'gender', ''),
    coalesce(input_payload->>'status', 'active'),
    coalesce((input_payload->>'is_left_handed')::boolean, false),
    coalesce(input_payload->>'country', ''),
    coalesce(input_payload->>'avatar_url', ''),
    nullif(input_payload->>'birthday', '')::date,
    coalesce(input_payload->>'preferred_position', ''),
    coalesce(input_payload->>'tagline_label', '')
  ) returning * into v_inserted;

  insert into public.security_events(player_id, attempt_kind, succeeded)
  values (v_inserted.id, 'admin_action', true);

  if v_inserted.email is not null then
    perform private.send_invite_email(v_inserted.id, 'added');
  end if;
  return next v_inserted;
end
$function$
;

CREATE OR REPLACE FUNCTION private.create_player_for_confirmed_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name    text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_level   numeric;
  v_source  text  := nullif(btrim(coalesce(v_meta ->> 'signup_source', '')), '');
  v_created uuid;
begin
  if v_name is null or nullif(btrim(new.email), '') is null then
    return new;
  end if;

  -- The hook refuses a bad level at signup. One that gets here anyway (signed
  -- up before this migration) is stored as no level, so the player levels at
  -- sign-in: failing the email confirmation would lock them out.
  begin
    v_level := private.level_to_store(v_meta ->> 'playtomic_level', 'optional');
  exception when raise_exception then
    v_level := null;
  end;

  -- An email already held by another player (case-insensitive) must not abort
  -- GoTrue's confirmation; the integrity check reports the user instead.
  begin
    insert into public.players(
      id, name, email, phone, notes,
      playtomic_level,
      playtomic_username, gender, status, is_left_handed,
      country, birthday, preferred_position, tagline_label
    ) values (
      new.id,
      left(v_name, 100),
      lower(new.email),
      coalesce(nullif(btrim(v_meta ->> 'phone'), ''), ''),
      coalesce(v_meta ->> 'notes', ''),
      v_level,
      coalesce(v_meta ->> 'playtomic_username', ''),
      coalesce(v_meta ->> 'gender', ''),
      'active',
      coalesce(v_meta ->> 'is_left_handed', '') = 'true',
      coalesce(v_meta ->> 'country', ''),
      private.parse_metadata_date(v_meta ->> 'birthday'),
      coalesce(v_meta ->> 'preferred_position', ''),
      coalesce(v_meta ->> 'tagline_label', '')
    )
    on conflict (id) do nothing
    returning id into v_created;
  exception when unique_violation then
    return new;
  end;

  -- Only for a player created just now. Losing the answer is acceptable;
  -- failing the email confirmation is not, so any error is swallowed.
  if v_created is not null and v_source is not null then
    begin
      insert into public.player_signup_source(player_id, source, detail)
      values (
        v_created,
        v_source,
        case when v_source in ('lobster', 'other')
             then nullif(btrim(coalesce(v_meta ->> 'signup_source_detail', '')), '')
        end
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.create_partner_player(input_requested_by uuid, input_tournament_id uuid, input_new_partner jsonb, input_consent boolean, input_skip_daily_cap boolean)
 RETURNS TABLE(status text, player_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(input_new_partner ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(input_new_partner ->> 'email', '')), ''));
  v_level numeric;
  v_email_problem text;
  v_id uuid;
begin
  if input_consent is not true then
    return query select 'consent_required'::text, null::uuid; return;
  end if;
  if v_name is null or length(v_name) > 100 then
    return query select 'invalid_name'::text, null::uuid; return;
  end if;
  v_email_problem := private.new_partner_email_problem(v_email);
  if v_email_problem = 'invalid_email' then
    return query select 'invalid_email'::text, null::uuid; return;
  end if;
  begin
    v_level := private.level_to_store(input_new_partner ->> 'playtomic_level', 'required');
  exception when raise_exception then
    return query select 'invalid_level'::text, null::uuid; return;
  end;
  if v_email_problem = 'email_in_use' then
    return query select 'email_in_use'::text, null::uuid; return;
  end if;

  if not input_skip_daily_cap then
    perform pg_advisory_xact_lock(hashtextextended('partner_cap:' || input_requested_by::text, 0));
    if (select count(*) from public.partner_invites pi
         where pi.requested_by = input_requested_by
           and pi.created_at > now() - interval '24 hours') >= 3 then
      return query select 'partner_cap_reached'::text, null::uuid; return;
    end if;
  end if;

  begin
    insert into public.players(name, email, phone, notes, playtomic_level,
      playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
      preferred_position, tagline_label)
    values (v_name, v_email, '', '', v_level,
      '', '', 'active', false, '', '', null,
      '', '')
    returning id into v_id;
  exception when unique_violation then
    -- A concurrent signup took the email between the check and the insert.
    return query select 'email_in_use'::text, null::uuid; return;
  end;

  insert into public.partner_invites(player_id, tournament_id, requested_by, consent_confirmed_at)
  values (v_id, input_tournament_id, input_requested_by, now());

  return query select 'ok'::text, v_id;
end
$function$
;

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

  v_new_level := CASE WHEN input_payload ? 'playtomic_level'
                      THEN private.level_to_store(input_payload->>'playtomic_level', 'keep', v_old_level)
                      ELSE v_old_level END;
  v_level_changed := v_new_level IS DISTINCT FROM v_old_level;

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
    playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
    tagline            = CASE WHEN input_payload ? 'tagline'            THEN nullif(btrim(input_payload->>'tagline'), '')            ELSE p.tagline END,
    tagline_label      = CASE WHEN input_payload ? 'tagline_label'      THEN nullif(btrim(input_payload->>'tagline_label'), '')      ELSE p.tagline_label END,
    avatar_url         = CASE WHEN input_payload ? 'avatar_url'         THEN nullif(btrim(input_payload->>'avatar_url'), '')         ELSE p.avatar_url END,
    playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
  WHERE p.id = v_player_id;

  -- coalesce: rating_events.prior_mu is NOT NULL and mm_rating may be null.
  IF v_level_changed
     AND private.has_level(v_new_level)
     AND NOT private.levelling_start_stands(v_player_id) THEN
    PERFORM public.record_mm_reset(
      v_player_id, v_new_level,
      coalesce(v_old_mm, v_old_level, 0), coalesce(v_old_sigma, 0.7), 'self_reset'
    );
  END IF;

  RETURN true;
END
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_player(input_target_id uuid, input_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  v_updated boolean := false;
  v_old_email text;
  v_new_email text;
  v_old_level numeric;
  v_old_mm numeric;
  v_old_sigma numeric;
  v_new_level numeric;
  v_level_changed boolean;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_target_id is null or input_payload is null then return false; end if;

  select email, playtomic_level, mm_rating, mm_sigma
    into v_old_email, v_old_level, v_old_mm, v_old_sigma
    from public.players where id = input_target_id for update;

  v_new_level := case when input_payload ? 'playtomic_level'
                      then private.level_to_store(input_payload->>'playtomic_level', 'keep', v_old_level)
                      else v_old_level end;
  v_level_changed := v_new_level is distinct from v_old_level;

  with upd as (
    update public.players p set
      name = case when input_payload ? 'name' then nullif(btrim(input_payload->>'name'), '') else p.name end,
      email = case
        when input_payload ? 'email' then
          case
            when nullif(btrim(input_payload->>'email'), '') is not null then btrim(input_payload->>'email')
            when coalesce((input_payload->>'email_cleared')::boolean, false) then null
            else p.email
          end
        else p.email
      end,
      phone = case when input_payload ? 'phone' then nullif(btrim(input_payload->>'phone'), '') else p.phone end,
      notes = case when input_payload ? 'notes' then nullif(btrim(input_payload->>'notes'), '') else p.notes end,
      playtomic_level = v_new_level,
      playtomic_username = case when input_payload ? 'playtomic_username' then nullif(btrim(input_payload->>'playtomic_username'), '') else p.playtomic_username end,
      gender = case when input_payload ? 'gender' then nullif(btrim(input_payload->>'gender'), '') else p.gender end,
      status = case when input_payload ? 'status' then nullif(btrim(input_payload->>'status'), '') else p.status end,
      is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      country = case when input_payload ? 'country' then nullif(btrim(input_payload->>'country'), '') else p.country end,
      avatar_url = case when input_payload ? 'avatar_url' then nullif(btrim(input_payload->>'avatar_url'), '') else p.avatar_url end,
      birthday = case when input_payload ? 'birthday' then nullif(input_payload->>'birthday', '')::date else p.birthday end,
      preferred_position = case when input_payload ? 'preferred_position' then nullif(btrim(input_payload->>'preferred_position'), '') else p.preferred_position end,
      tagline = case when input_payload ? 'tagline' then nullif(btrim(input_payload->>'tagline'), '') else p.tagline end,
      tagline_label = case when input_payload ? 'tagline_label' then nullif(btrim(input_payload->>'tagline_label'), '') else p.tagline_label end,
      playtomic_updated_at = case when (input_payload ? 'playtomic_level') then now() else p.playtomic_updated_at end
    where p.id = input_target_id
    returning p.email
  )
  select email into v_new_email from upd;
  v_updated := found;

  if v_updated then
    insert into public.security_events(player_id, attempt_kind, succeeded)
    values (input_target_id, 'admin_action', true);

    if v_old_email is not null and v_new_email is null then
      insert into public.player_email_clears(player_id, old_email, cleared_by, cleared_via)
      values (input_target_id, v_old_email, auth.uid(), 'admin_update_player');
    end if;

    -- coalesce: rating_events.prior_mu is NOT NULL and mm_rating may be null.
    if v_level_changed
       and private.has_level(v_new_level)
       and not private.levelling_start_stands(input_target_id) then
      perform public.record_mm_reset(
        input_target_id, v_new_level,
        coalesce(v_old_mm, v_old_level, 0), coalesce(v_old_sigma, 0.7), 'admin_edit'
      );
    end if;
  end if;

  return v_updated;
end $function$
;

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
     or jsonb_typeof(coalesce(input_answers -> 'playtomic_level', 'null')) not in ('number', 'null')
     or jsonb_typeof(coalesce(input_answers -> 'prefilled', 'false')) <> 'boolean' then
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
        playtomic_level, start_source, start_mu, start_sigma, prefilled
      ) values (
        v_player_id,
        input_answers ->> 'years_playing',
        input_answers ->> 'frequency',
        input_answers ->> 'lessons',
        input_answers ->> 'racket_sports',
        input_answers ->> 'walls',
        case when private.has_level(v_old_level) then v_old_level end,
        'none', null, null, false
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
$function$
;


