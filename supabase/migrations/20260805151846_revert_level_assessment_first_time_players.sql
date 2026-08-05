-- Revert: undo the level_assessment_first_time_players migration.
-- Drops the new table (and its policy/index/comment via cascade) and restores
-- self_signup_player to its exact pre-migration definition. No player rows,
-- no player columns, and no other tables were ever touched.
--
-- NOTE: applied to production out-of-band on 2026-08-05, backfilled here so
-- repo history matches prod. Net effect of this file plus 20260805151259 is
-- zero — they are kept as a pair to preserve a linear, replayable history.

drop table if exists public.player_level_assessments cascade;

create or replace function public.self_signup_player(input_payload jsonb, input_device_id text DEFAULT NULL::text, input_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(player_id uuid, pin text, was_existing boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  v_name        text;
  v_email       text;
  v_phone       text;
  v_existing_id uuid;
  v_recent_signups int;
  v_new_pin     text;
  v_inserted    public.players%rowtype;
  c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';

  if input_payload is null then
    raise exception 'missing payload' using errcode = '22023';
  end if;

  v_name  := nullif(btrim(coalesce(input_payload->>'name', '')), '');
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
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0)
      + coalesce((input_payload->>'adjustment')::numeric, 0),
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
  returning * into v_inserted;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_inserted.id, input_device_id, input_user_agent, 'signup', true);

  return query select v_inserted.id, v_inserted.pin, false;
end;
$function$;
