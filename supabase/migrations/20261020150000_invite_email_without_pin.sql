-- Admin invites without PINs (docs/pin-auth-removal C-5, C-6).
--
-- The invite and add RPCs no longer generate or store a PIN: the player signs
-- in with their email address, and the invite email says so. The email goes
-- through private.send_invite_email, a copy of send_pin_email that carries no
-- credential. admin_resend_invite replaces admin_regenerate_pin for the new
-- client; admin_regenerate_pin and self_signup_player stay until the PIN
-- sunset so the current client keeps working.

-- ── private.send_invite_email ───────────────────────────────────────────────
create or replace function private.send_invite_email(input_player_id uuid, input_kind text)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions', 'net'
as $function$
declare
  v_email text; v_name text; v_key text; v_team text;
  v_url text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-invite-email';
  v_request_id bigint;
begin
  if input_kind not in ('league_invite', 'added', 'resend') then
    raise exception 'send_invite_email: invalid kind: %', input_kind;
  end if;
  select email, name into v_email, v_name from public.players where id = input_player_id limit 1;
  if v_email is null or length(trim(v_email)) < 3 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or v_email like '%@padelobsters.internal' then
    return null;
  end if;
  if input_kind = 'league_invite' then
    select lt.team_name into v_team
      from public.league_teams lt
      join public.leagues l on l.id = lt.league_id
     where input_player_id in (lt.player1_id, lt.player2_id)
     order by l.created_at desc
     limit 1;
  end if;
  v_key := private.get_edge_service_role_key();
  if v_key is null then raise exception 'send_invite_email: vault secret edge_send_pin_service_role is missing'; end if;
  select net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'player_id', input_player_id::text, 'email', v_email, 'name', v_name,
      'kind', input_kind, 'team_name', nullif(btrim(v_team), '')),
    headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
    timeout_milliseconds := 5000
  ) into v_request_id;
  return v_request_id;
end;
$function$;

revoke all on function private.send_invite_email(uuid, text) from public, anon, authenticated;

-- ── admin_invite_league_player ──────────────────────────────────────────────
-- Same checks as 20261012130000; no PIN, returns NULL (the client already
-- hides a null PIN).
create or replace function public.admin_invite_league_player(input_player_id uuid, input_email text)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_email  text := lower(nullif(btrim(input_email), ''));
  v_status text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();

  if input_player_id is null or v_email is null then
    raise exception 'player_id and email are required' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
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

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (input_player_id, 'admin_action', true);

  perform private.send_invite_email(input_player_id, 'league_invite');
  return null;
end;
$function$;

-- ── admin_add_player ────────────────────────────────────────────────────────
create or replace function public.admin_add_player(input_payload jsonb)
 returns setof players
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_inserted public.players%rowtype;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_payload is null then return; end if;

  insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
    preferred_position, tagline_label, pin, pin_hash)
  values (
    coalesce(input_payload->>'name', ''),
    nullif(btrim(input_payload->>'email'), ''),
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
    coalesce(input_payload->>'tagline_label', ''),
    null,
    null
  ) returning * into v_inserted;

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (v_inserted.id, 'admin_action', true);

  if v_inserted.email is not null then
    perform private.send_invite_email(v_inserted.id, 'added');
  end if;
  return next v_inserted;
end
$function$;

-- ── admin_resend_invite ─────────────────────────────────────────────────────
create or replace function public.admin_resend_invite(input_player_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
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

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (input_player_id, 'admin_action', true);

  perform private.send_invite_email(input_player_id, 'resend');
  return v_email;
end;
$function$;

revoke all on function public.admin_resend_invite(uuid) from public, anon, authenticated;
grant execute on function public.admin_resend_invite(uuid) to authenticated;
