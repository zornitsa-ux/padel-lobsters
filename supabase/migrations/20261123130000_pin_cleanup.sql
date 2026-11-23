-- ============================================================================
-- PIN auth removal PR 6 (T11): Phase 4 cleanup (docs/pin-auth-removal/,
-- DESIGN §3 Phase 4, PLAN §3.6). Cutover was 7 Nov; no client has called the
-- PIN functions since, and PR 5 revoked the last two from anon.
--
-- Release order: delete the verify-pin and send-pin-email edge functions
-- first, then db push, then db:grants:prod.
--
-- 1. Drop the PIN functions, their trigger and the admin PIN secret.
-- 2. Rename pin_attempts to security_events; the functions that log to it or
--    read it are re-created against the new name (bodies otherwise unchanged).
-- 3. Drop players.pin, pin_hash and pin_changes; players_public is rebuilt
--    without pin_changes.
-- The edge_send_pin_service_role Vault secret stays: send_invite_email
-- (private.get_edge_service_role_key) uses it too.
-- ============================================================================

-- ── 1. PIN functions ─────────────────────────────────────────────────────────

drop trigger if exists trg_sync_player_pin_hash on public.players;
drop function if exists public.sync_player_pin_hash();
drop function if exists public.verify_player_pin_v2(text, text, text);
drop function if exists public.self_signup_player(jsonb, text, text);
drop function if exists public.admin_regenerate_pin(uuid);
drop function if exists private.generate_unique_pin();
drop function if exists private.send_pin_email(uuid, text, text);
-- PIN-era whole-roster and PIN-gated PII reads; nothing calls them. The second
-- exists in production only (no migration creates it).
drop function if exists public.get_all_players_with_pii_v2();
drop function if exists public.admin_get_player_pii_v2(text, text, uuid, text);
drop table if exists private.admin_secrets;

-- ── 2. pin_attempts → security_events ────────────────────────────────────────
-- attempt_kind values and historical rows stay as they are (DESIGN F-6).

alter table public.pin_attempts rename to security_events;
alter sequence public.pin_attempts_id_seq rename to security_events_id_seq;
alter index public.pin_attempts_pkey rename to security_events_pkey;
alter index public.pin_attempts_by_device_time rename to security_events_by_device_time;
alter index public.pin_attempts_by_player_time rename to security_events_by_player_time;
alter index public.pin_attempts_recent_failures rename to security_events_recent_failures;
alter table public.security_events
  rename constraint pin_attempts_attempt_kind_check to security_events_attempt_kind_check;

-- Re-created from production's definitions (identical to the migrations'),
-- with public.pin_attempts → public.security_events and, in the three player
-- inserts, the pin and pin_hash columns removed. Grants are kept.

CREATE OR REPLACE FUNCTION private.create_partner_player(input_requested_by uuid, input_tournament_id uuid, input_new_partner jsonb, input_consent boolean, input_skip_daily_cap boolean)
 RETURNS TABLE(status text, player_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(input_new_partner ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(input_new_partner ->> 'email', '')), ''));
  v_level_text text := nullif(btrim(coalesce(input_new_partner ->> 'playtomic_level', '')), '');
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
  -- The cast only after the format check: OR doesn't promise evaluation order.
  if v_level_text is null or v_level_text !~ '^[0-9]+(\.[0-9]+)?$' then
    return query select 'invalid_level'::text, null::uuid; return;
  end if;
  v_level := v_level_text::numeric;
  if v_level <= 0 or v_level > 7 then
    return query select 'invalid_level'::text, null::uuid; return;
  end if;
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
    insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
      playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
      preferred_position, tagline_label)
    values (v_name, v_email, '', '', v_level, 0, v_level,
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

CREATE OR REPLACE FUNCTION private.create_player_for_confirmed_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name    text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_level   numeric := private.parse_metadata_level(v_meta ->> 'playtomic_level');
  v_source  text  := nullif(btrim(coalesce(v_meta ->> 'signup_source', '')), '');
  v_created uuid;
begin
  if v_name is null or nullif(btrim(new.email), '') is null then
    return new;
  end if;

  -- An email already held by another player (case-insensitive) must not abort
  -- GoTrue's confirmation; the integrity check reports the user instead.
  begin
    insert into public.players(
      id, name, email, phone, notes,
      playtomic_level, adjustment, adjusted_level,
      playtomic_username, gender, status, is_left_handed,
      country, birthday, preferred_position, tagline_label
    ) values (
      new.id,
      left(v_name, 100),
      lower(new.email),
      coalesce(nullif(btrim(v_meta ->> 'phone'), ''), ''),
      coalesce(v_meta ->> 'notes', ''),
      v_level,
      0,
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
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_payload is null then return; end if;
  if v_email is not null and not private.is_valid_email(v_email) then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
    preferred_position, tagline_label)
  values (
    coalesce(input_payload->>'name', ''),
    v_email,
    coalesce(input_payload->>'phone', ''),
    coalesce(input_payload->>'notes', ''),
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0) + coalesce((input_payload->>'adjustment')::numeric, 0),
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

CREATE OR REPLACE FUNCTION public.admin_auth_readiness()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.require_admin();

  return (
    with latest as (
      select p.id, p.name, u.last_sign_in_at,
             (select max(pa.attempted_at)
                from public.security_events pa
               where pa.player_id = p.id
                 and pa.attempt_kind = 'player'
                 and pa.succeeded) as pin_at
        from public.players p
        join auth.users u on u.id = p.id
       where coalesce(p.status, 'active') = 'active'
         and u.last_sign_in_at is not null
    ),
    classified as (
      select id, name, pin_at,
             (pin_at is not null
              and pin_at <= last_sign_in_at
              and last_sign_in_at - pin_at <= interval '5 minutes') as by_pin
        from latest
    )
    select jsonb_build_object(
      'no_email', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name, p.id)
          from public.players p
          join auth.users u on u.id = p.id
         where coalesce(p.status, 'active') = 'active'
           and u.email like 'player-%@padelobsters.internal'
      ), '[]'::jsonb),
      'recent_pin_users', coalesce((
        select jsonb_agg(
                 jsonb_build_object('id', c.id, 'name', c.name, 'last_pin_at', c.pin_at)
                 order by c.pin_at desc, c.id)
          from classified c
         where c.by_pin and c.pin_at > now() - interval '14 days'
      ), '[]'::jsonb),
      'switched_count', (select count(*) from classified where not by_pin),
      'still_pin_count', (select count(*) from classified where by_pin)
    )
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.admin_delete_player(input_target_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  v_rows integer := 0;
  v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_target_id is null then return false; end if;

  update public.players p
     set status = 'deleted',
         email = null
   where p.id = input_target_id
     and coalesce(p.status, 'active') <> 'deleted';
  get diagnostics v_rows = row_count;
  v_did_delete := v_rows > 0;

  if v_did_delete then
    insert into public.security_events(player_id, attempt_kind, succeeded)
    values (input_target_id, 'admin_action', true);
  end if;
  return v_did_delete;
end $function$

;

CREATE OR REPLACE FUNCTION public.admin_get_player_pii(input_target_id uuid)
 RETURNS TABLE(id uuid, email text, phone text, birthday date, notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_row record;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();
  if input_target_id is null then
    raise exception 'missing target player' using errcode = '22023';
  end if;

  select p.id, p.email, p.phone, p.birthday, p.notes
    into v_row
    from public.players p
   where p.id = input_target_id;

  if not found then
    return;
  end if;

  insert into public.security_events(player_id, attempt_kind, succeeded)
  values (input_target_id, 'player_pii_read', true);

  id := v_row.id; email := v_row.email; phone := v_row.phone;
  birthday := v_row.birthday; notes := v_row.notes;
  return next;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.admin_invite_league_player(input_player_id uuid, input_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_email  text := lower(nullif(btrim(input_email), ''));
  v_status text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();

  if input_player_id is null or v_email is null then
    raise exception 'player_id and email are required' using errcode = '22023';
  end if;
  if not private.is_valid_email(v_email) then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select status into v_status from public.players where id = input_player_id for update;
  if not found then
    raise exception 'player not found' using errcode = '22023';
  end if;
  if coalesce(v_status, 'active') <> 'placeholder' then
    raise exception 'player is not a placeholder' using errcode = '22023';
  end if;

  if exists (
       select 1 from public.players p
        where lower(btrim(p.email)) = v_email
          and coalesce(p.status, 'active') <> 'deleted'
          and p.id <> input_player_id
     )
     or exists (
       select 1 from auth.users u where lower(u.email) = v_email and u.id <> input_player_id
     ) then
    raise exception 'email in use' using errcode = '22023';
  end if;

  update public.players
     set email = v_email, status = 'active'
   where id = input_player_id;

  insert into public.security_events(player_id, attempt_kind, succeeded)
  values (input_player_id, 'admin_action', true);

  perform private.send_invite_email(input_player_id, 'league_invite');
  return null;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.admin_list_security_events(input_limit integer DEFAULT 100)
 RETURNS TABLE(id bigint, player_id uuid, player_name text, device_id text, user_agent text, attempt_kind text, succeeded boolean, attempted_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  return query
    select pa.id, pa.player_id, p.name, pa.device_id, pa.user_agent,
           pa.attempt_kind, pa.succeeded, pa.attempted_at
      from public.security_events pa
      left join public.players p on p.id = pa.player_id
     order by pa.attempted_at desc
     limit greatest(1, least(input_limit, 500));
end
$function$

;

CREATE OR REPLACE FUNCTION public.admin_resend_invite(input_player_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_email  text;
  v_status text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();

  select p.email, p.status into v_email, v_status from public.players p where p.id = input_player_id;
  if not found then
    raise exception 'player not found' using errcode = '22023';
  end if;
  if v_status = 'placeholder' then
    raise exception 'player is a placeholder' using errcode = '22023';
  end if;
  if v_email is null or exists (
       select 1 from auth.users u
        where u.id = input_player_id and u.email like '%@padelobsters.internal'
     ) then
    raise exception 'player has no email' using errcode = '22023';
  end if;
  if not private.is_valid_email(v_email) then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  insert into public.security_events(player_id, attempt_kind, succeeded)
  values (input_player_id, 'admin_action', true);

  perform private.send_invite_email(input_player_id, 'resend');
  return v_email;
end;
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

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     and v_new_level is distinct from v_old_level;

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
      adjusted_level = case when input_payload ? 'playtomic_level' then v_new_level else p.adjusted_level end,
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

    -- coalesce to 0: rating_events.prior_mu is NOT NULL and playtomic_level is nullable.
    if v_level_changed
       and v_new_level > 0
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

CREATE OR REPLACE FUNCTION public.get_payment_reminder_link(input_registration_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_player_id uuid;
  v_tournament_id uuid;
  v_team_id uuid;
  v_player_name text;
  v_phone text;
  v_tournament_name text;
  v_tikkie_link text;
  v_team_price numeric;
  v_partner_name text;
  v_digits text;
  v_message text;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();

  select r.player_id, r.tournament_id, r.team_id
    into v_player_id, v_tournament_id, v_team_id
    from public.registrations r
   where r.id = input_registration_id;

  if v_player_id is null then
    raise exception 'registration_not_found' using errcode = 'P0002';
  end if;

  select p.name, p.phone into v_player_name, v_phone
    from public.players p where p.id = v_player_id;

  select t.name, t.tikkie_link, 2 * t.total_price / nullif(t.max_players, 0)
    into v_tournament_name, v_tikkie_link, v_team_price
    from public.tournaments t where t.id = v_tournament_id;

  -- Audited unconditionally (the phone column was read either way), but
  -- `succeeded` records whether a usable link came out.
  if coalesce(v_tikkie_link, '') = '' then
    insert into public.security_events(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return null;
  end if;

  v_digits := regexp_replace(coalesce(v_phone, ''), '[\s\-()]', '', 'g');
  if v_digits !~ '^\+\d{8,15}$' then
    insert into public.security_events(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return null;
  end if;
  v_digits := regexp_replace(v_digits, '^\+', '');

  insert into public.security_events(player_id, attempt_kind, succeeded)
  values (v_player_id, 'payment_reminder', true);

  if v_team_id is not null then
    select p.name into v_partner_name
      from public.registrations r
      join public.players p on p.id = r.player_id
     where r.team_id = v_team_id
       and r.player_id <> v_player_id
       and r.status in ('registered', 'waitlist');
  end if;

  v_message := 'Hi ' || coalesce(nullif(v_player_name, ''), 'there')
    || '! Friendly reminder to pay for ' || coalesce(nullif(v_tournament_name, ''), 'the event');
  if v_team_id is not null then
    v_message := v_message || ' for your team (you and '
      || coalesce(nullif(split_part(trim(v_partner_name), ' ', 1), ''), 'your partner') || ')'
      || case when v_team_price > 0
              then ', €' || regexp_replace(to_char(v_team_price, 'FM999990.00'), '\.00$', '')
              else '' end;
  end if;
  v_message := v_message || ' via Tikkie: ' || v_tikkie_link || ' 🙏';

  return 'https://wa.me/' || v_digits || '?text=' || public._url_encode(v_message);
end;
$function$

;

-- ── 3. players: PIN columns ──────────────────────────────────────────────────

drop view public.players_public;

alter table public.players
  drop column pin,
  drop column pin_hash,
  drop column pin_changes;

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
    adjustment,
    adjusted_level,
    avatar_url,
    created_at,
        CASE
            WHEN (birthday IS NULL) THEN NULL::text
            ELSE to_char((birthday)::timestamp with time zone, 'MM-DD'::text)
        END AS birthday_md,
    (EXTRACT(month FROM birthday))::integer AS birthday_month,
    (EXTRACT(day FROM birthday))::integer AS birthday_day,
    learned_rating,
    learned_rd,
    learned_volatility,
    learned_matches_count,
    learned_updated_at,
    role
   FROM players;

revoke all on public.players_public from anon, authenticated;
grant select on public.players_public to authenticated;
