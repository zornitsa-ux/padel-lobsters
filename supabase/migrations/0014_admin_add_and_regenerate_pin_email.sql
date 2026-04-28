-- Migration 0014 — admin_add_player and admin_regenerate_pin email the PIN
--
-- Phase 2d: when an admin adds a new player or regenerates an existing
-- player's PIN, the new PIN is sent to the player's email via the
-- send-pin-email Edge Function. Plaintext PIN is still stored in
-- public.players.pin for backwards compatibility — return shapes are
-- unchanged so the frontend keeps working without modification.
--
-- The plaintext column will be dropped in a later migration once the
-- frontend stops displaying / relying on returned PIN values.

create or replace function public.admin_add_player(
  input_admin_pin text,
  input_payload jsonb,
  input_device_id text default null,
  input_user_agent text default null
)
returns setof players
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
#variable_conflict use_column
declare v_new_pin text; v_inserted public.players%rowtype;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  if input_payload is null then return; end if;

  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p
       where p.pin = v_new_pin and coalesce(p.status,'active') = 'active'
    );
  end loop;

  insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
    preferred_position, tagline_label, pin)
  values (
    coalesce(input_payload->>'name', ''),
    coalesce(input_payload->>'email', ''),
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
    v_new_pin
  ) returning * into v_inserted;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_inserted.id, input_device_id, input_user_agent, 'admin_action', true);

  if v_inserted.email is not null and length(trim(v_inserted.email)) > 3 then
    perform private.send_pin_email(v_inserted.id, v_new_pin, 'new_signup');
  end if;

  return next v_inserted;
end $function$;

create or replace function public.admin_regenerate_pin(
  input_admin_pin text,
  input_target_id uuid,
  input_device_id text default null,
  input_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
#variable_conflict use_column
declare v_new_pin text; v_updated boolean := false; v_email text;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return null; end if;
  if input_target_id is null then return null; end if;

  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p
       where p.pin = v_new_pin and p.id <> input_target_id and coalesce(p.status,'active') = 'active'
    );
  end loop;

  with upd as (
    update public.players p set pin = v_new_pin where p.id = input_target_id returning p.email
  ) select email into v_email from upd;
  v_updated := v_email is distinct from null or v_email is null and exists (
    select 1 from public.players where id = input_target_id
  );

  if not v_updated then return null; end if;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (input_target_id, input_device_id, input_user_agent, 'admin_action', true);

  if v_email is not null and length(trim(v_email)) > 3 then
    perform private.send_pin_email(input_target_id, v_new_pin, 'regenerated');
  end if;

  return v_new_pin;
end $function$;
