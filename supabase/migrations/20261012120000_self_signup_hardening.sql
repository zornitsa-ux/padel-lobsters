-- self_signup_player hardening.
--
-- * Refuses a signup whose name matches a placeholder (a teammate an admin
--   entered by name). Placeholders are activated only through the admin
--   invite (admin_invite_league_player), so an admin confirms who is taking
--   the profile; self-signup would otherwise create a duplicate person.
-- * Never hands out a PIN that is already in use (see generate_unique_pin).
-- * Taken emails and bad levels raise clear errors instead of raw
--   constraint/cast failures; decimal commas are accepted.

-- ── PIN generation ──────────────────────────────────────────────────────────
-- verify_player_pin_v2 matches on pin_hash, and some active players have a
-- hash but no plaintext pin (legacy forgot-PIN resets). A plaintext-only
-- uniqueness check can therefore hand a new player someone else's PIN, after
-- which verify_player_pin_v2 resolves it to whichever row it finds first.
create or replace function private.generate_unique_pin()
 returns text
 language plpgsql
 volatile
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_pin text;
begin
  for i in 1..20 loop
    v_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    if not exists (
      select 1 from public.players p
       where coalesce(p.status, 'active') = 'active'
         and (
           p.pin = v_pin
           or (nullif(p.pin, '') is null
               and p.pin_hash is not null
               and p.pin_hash = extensions.crypt(v_pin, p.pin_hash))
         )
    ) then
      return v_pin;
    end if;
  end loop;
  raise exception 'could not allocate a unique pin' using errcode = 'P0001';
end;
$function$;

revoke all on function private.generate_unique_pin() from public, anon, authenticated;

-- ── self_signup_player ─────────────────────────────────────────────────────
create or replace function public.self_signup_player(
  input_payload jsonb,
  input_device_id text default null,
  input_user_agent text default null
)
 returns table(player_id uuid, pin text, was_existing boolean)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_name        text;
  v_email       text;
  v_phone       text;
  v_level_text  text;
  v_level       numeric;
  v_existing_id uuid;
  v_recent_signups int;
  v_player      public.players%rowtype;
  c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';

  if input_payload is null then
    raise exception 'missing payload' using errcode = '22023';
  end if;

  v_name  := nullif(regexp_replace(btrim(coalesce(input_payload->>'name', '')), '\s+', ' ', 'g'), '');
  v_email := nullif(btrim(lower(coalesce(input_payload->>'email', ''))), '');
  v_phone := nullif(btrim(coalesce(input_payload->>'phone', '')), '');

  if v_name is null or v_email is null then
    raise exception 'name and email are required' using errcode = '22023';
  end if;
  if length(v_name) > 100 or length(v_email) > 200 then
    raise exception 'name or email too long' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  -- Decimal commas ("2,2") are common for Dutch players.
  v_level_text := replace(btrim(coalesce(input_payload->>'playtomic_level', '')), ',', '.');
  if v_level_text = '' then
    v_level := 0;
  elsif v_level_text ~ '^\d+(\.\d+)?$' then
    v_level := v_level_text::numeric;
  else
    raise exception 'invalid level' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.players p
     where p.status = 'placeholder'
       and lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = lower(v_name)
  ) then
    raise exception 'placeholder needs invite' using errcode = '22023';
  end if;

  if input_device_id is not null then
    select count(*) into v_recent_signups
      from public.pin_attempts pa
     where pa.device_id    = input_device_id
       and pa.attempt_kind = 'signup'
       and pa.attempted_at > now() - interval '24 hours';
    if v_recent_signups >= c_max_per_device_24h then
      raise exception 'rate limited' using errcode = 'P0001';
    end if;
  end if;

  select p.id into v_existing_id
    from public.players p
   where lower(coalesce(p.email,'')) = v_email
     and coalesce(p.status,'active') = 'active'
   limit 1;

  if v_existing_id is not null then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_existing_id, input_device_id, input_user_agent, 'signup', false);
    return query select null::uuid, null::text, true;
    return;
  end if;

  -- Same scope as players_email_lower_unique and auth.users' email key, so a
  -- taken address gets a clear error instead of a raw unique violation.
  if exists (
       select 1 from public.players p
        where lower(btrim(p.email)) = v_email
          and coalesce(p.status, 'active') <> 'deleted'
     )
     or exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'email in use' using errcode = '22023';
  end if;

  insert into public.players(
    name, email, phone, notes,
    playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed,
    country, avatar_url, birthday, preferred_position,
    tagline_label, pin
  ) values (
    v_name,
    v_email,
    coalesce(v_phone, ''),
    coalesce(input_payload->>'notes', ''),
    v_level,
    coalesce((input_payload->>'adjustment')::numeric, 0),
    v_level + coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce(input_payload->>'playtomic_username', ''),
    coalesce(input_payload->>'gender', ''),
    'active',
    coalesce((input_payload->>'is_left_handed')::boolean, false),
    coalesce(input_payload->>'country', ''),
    coalesce(input_payload->>'avatar_url', ''),
    nullif(input_payload->>'birthday', '')::date,
    coalesce(input_payload->>'preferred_position', ''),
    coalesce(input_payload->>'tagline_label', ''),
    private.generate_unique_pin()
  )
  returning * into v_player;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_player.id, input_device_id, input_user_agent, 'signup', true);

  return query select v_player.id, v_player.pin, false;
end;
$function$;

revoke all on function public.self_signup_player(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.self_signup_player(jsonb, text, text) to anon;
