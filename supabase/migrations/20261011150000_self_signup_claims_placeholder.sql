-- self_signup_player can claim a placeholder row.
--
-- Placeholders (status = 'placeholder') are created when someone enters a
-- teammate by name in a league/tournament registration. When that person
-- later joins, the signup form offers to "complete" the placeholder so
-- their registrations follow them. The visitor is anonymous at that point,
-- so the claim has to happen server-side here rather than via
-- update_my_profile.
--
-- Only placeholders are claimable, and only by exact (case-insensitive)
-- name match. Active players are never claimable this way.

drop function if exists public.self_signup_player(jsonb, text, text);

create function public.self_signup_player(
  input_payload jsonb,
  input_device_id text default null,
  input_user_agent text default null,
  input_claim_placeholder_id uuid default null
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
  v_level       numeric;
  v_existing_id uuid;
  v_recent_signups int;
  v_new_pin     text;
  v_player      public.players%rowtype;
  c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';

  if input_payload is null then
    raise exception 'missing payload' using errcode = '22023';
  end if;

  v_name  := nullif(btrim(coalesce(input_payload->>'name', '')), '');
  v_email := nullif(btrim(lower(coalesce(input_payload->>'email', ''))), '');
  v_phone := nullif(btrim(coalesce(input_payload->>'phone', '')), '');
  v_level := coalesce(nullif(replace(btrim(coalesce(input_payload->>'playtomic_level', '')), ',', '.'), '')::numeric, 0);

  if v_name is null or v_email is null then
    raise exception 'name and email are required' using errcode = '22023';
  end if;
  if length(v_name) > 100 or length(v_email) > 200 then
    raise exception 'name or email too long' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
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

  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p
       where p.pin = v_new_pin and coalesce(p.status,'active') = 'active'
    );
  end loop;

  if input_claim_placeholder_id is not null then
    update public.players p set
      name               = v_name,
      email              = v_email,
      phone              = coalesce(v_phone, ''),
      notes              = coalesce(input_payload->>'notes', ''),
      playtomic_level    = v_level,
      adjusted_level     = v_level + coalesce(p.adjustment, 0),
      playtomic_username = coalesce(input_payload->>'playtomic_username', ''),
      gender             = coalesce(input_payload->>'gender', ''),
      status             = 'active',
      is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean, false),
      country            = coalesce(input_payload->>'country', ''),
      avatar_url         = coalesce(input_payload->>'avatar_url', ''),
      birthday           = nullif(input_payload->>'birthday', '')::date,
      preferred_position = coalesce(input_payload->>'preferred_position', ''),
      tagline_label      = coalesce(input_payload->>'tagline_label', ''),
      pin                = v_new_pin
    where p.id = input_claim_placeholder_id
      and p.status = 'placeholder'
      and lower(btrim(p.name)) = lower(v_name)
    returning * into v_player;

    if v_player.id is null then
      raise exception 'placeholder not claimable' using errcode = '22023';
    end if;
  else
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
      v_new_pin
    )
    returning * into v_player;
  end if;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_player.id, input_device_id, input_user_agent, 'signup', true);

  return query select v_player.id, v_player.pin, false;
end;
$function$;

revoke all on function public.self_signup_player(jsonb, text, text, uuid) from public;
grant execute on function public.self_signup_player(jsonb, text, text, uuid) to anon;
