-- =====================================================================
-- Padel Lobsters — Security Phase 2c: write RPCs + pin_changes counter
-- =====================================================================
-- Wraps the four remaining direct-table writes on `players` in
-- SECURITY DEFINER RPCs so we can REVOKE all DML grants from anon and
-- close the bulk-PII vector for good (final REVOKE applies in 0009,
-- only after the app cuts over).
--
-- Five new RPCs:
--   - admin_add_player(admin_pin, payload, device_id) → players
--       Generates a fresh 4-digit PIN server-side and returns the new
--       row including the PIN so admin can show/share it.
--   - admin_update_player(admin_pin, target_id, payload, device_id) → bool
--       Admin can edit any player's full record (incl. status/adjustment).
--   - update_my_profile(pin, device_id, payload) → bool
--       Player updates their own record. Restricted to safe fields
--       (no status, adjustment, notes, etc. — those stay admin-only).
--       Requires the calling device to be trusted.
--   - admin_delete_player(admin_pin, target_id, device_id) → bool
--   - admin_regenerate_pin(admin_pin, target_id, device_id) → text
--       Returns the new PIN so admin can WhatsApp it to the player.
--
-- Plus: pin_changes counter on the players table, incremented by the
-- existing sync_player_pin_hash trigger every time a PIN actually
-- changes (not on initial signup INSERT). Surfaces in the admin view
-- as "(N)" next to the PIN.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. pin_changes counter + trigger update
-- ---------------------------------------------------------------------

alter table public.players add column if not exists pin_changes integer not null default 0;

-- Extend the existing trigger to also bump pin_changes on actual changes.
create or replace function public.sync_player_pin_hash()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  if NEW.pin is not null and NEW.pin <> '' then
    if TG_OP = 'INSERT' then
      -- New signup: hash the PIN, leave counter at default 0.
      NEW.pin_hash := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 10));
    elsif NEW.pin is distinct from OLD.pin then
      -- PIN actually changed: re-hash, bump counter.
      NEW.pin_hash    := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 10));
      NEW.pin_changes := coalesce(OLD.pin_changes, 0) + 1;
    end if;
  end if;
  return NEW;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. admin_add_player — returns the new players row (incl. PIN)
-- ---------------------------------------------------------------------

create or replace function public.admin_add_player(
  input_admin_pin   text,
  input_payload     jsonb,
  input_device_id   text default null,
  input_user_agent  text default null
)
returns setof public.players
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
declare
  v_new_pin text;
  v_inserted public.players%rowtype;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  if input_payload is null then return; end if;

  -- Generate a fresh 4-digit PIN server-side. Retry on the (extremely
  -- unlikely) collision with an existing active player's PIN.
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
    coalesce(input_payload->>'name', ''),
    coalesce(input_payload->>'email', ''),
    coalesce(input_payload->>'phone', ''),
    coalesce(input_payload->>'notes', ''),
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0)
      + coalesce((input_payload->>'adjustment')::numeric, 0),
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
  )
  returning * into v_inserted;

  insert into public.pin_attempts(
    player_id, device_id, user_agent, attempt_kind, succeeded
  ) values (
    v_inserted.id, input_device_id, input_user_agent, 'admin_action', true
  );

  return next v_inserted;
end;
$$;
revoke execute on function public.admin_add_player(text, jsonb, text, text) from public;
grant  execute on function public.admin_add_player(text, jsonb, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. admin_update_player — admin edits any player's full record
-- ---------------------------------------------------------------------

create or replace function public.admin_update_player(
  input_admin_pin   text,
  input_target_id   uuid,
  input_payload     jsonb,
  input_device_id   text default null,
  input_user_agent  text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
declare v_updated boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return false; end if;
  if input_target_id is null or input_payload is null then return false; end if;

  with upd as (
    update public.players p set
      name               = coalesce(input_payload->>'name', p.name),
      email              = coalesce(input_payload->>'email', p.email),
      phone              = coalesce(input_payload->>'phone', p.phone),
      notes              = coalesce(input_payload->>'notes', p.notes),
      playtomic_level    = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjustment         = coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      adjusted_level     = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level)
                           + coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      playtomic_username = coalesce(input_payload->>'playtomic_username', p.playtomic_username),
      gender             = coalesce(input_payload->>'gender', p.gender),
      status             = coalesce(input_payload->>'status', p.status),
      is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      country            = coalesce(input_payload->>'country', p.country),
      avatar_url         = coalesce(input_payload->>'avatar_url', p.avatar_url),
      birthday           = coalesce(nullif(input_payload->>'birthday', '')::date, p.birthday),
      preferred_position = coalesce(input_payload->>'preferred_position', p.preferred_position),
      tagline            = coalesce(input_payload->>'tagline', p.tagline),
      tagline_label      = coalesce(input_payload->>'tagline_label', p.tagline_label),
      playtomic_updated_at = case
        when (input_payload ? 'playtomic_level') then now()
        else p.playtomic_updated_at
      end
     where p.id = input_target_id
     returning 1
  ) select exists(select 1 from upd) into v_updated;

  if v_updated then
    insert into public.pin_attempts(
      player_id, device_id, user_agent, attempt_kind, succeeded
    ) values (
      input_target_id, input_device_id, input_user_agent, 'admin_action', true
    );
  end if;

  return v_updated;
end;
$$;
revoke execute on function public.admin_update_player(text, uuid, jsonb, text, text) from public;
grant  execute on function public.admin_update_player(text, uuid, jsonb, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. update_my_profile — self-edit, restricted fields, trusted device
-- ---------------------------------------------------------------------
-- Allowed self-fields: name, email, phone, birthday, country, gender,
-- is_left_handed, preferred_position, playtomic_level, playtomic_username,
-- tagline, tagline_label, avatar_url.
-- NOT allowed: status, adjustment, adjusted_level, notes (admin-only).

create or replace function public.update_my_profile(
  input_pin        text,
  input_device_id  text,
  input_payload    jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
declare
  v_player_id   uuid;
  v_is_trusted  boolean;
  v_updated     boolean := false;
begin
  set local statement_timeout = '30s';

  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_device_id is null or input_payload is null then return false; end if;

  -- Caller's device must be trusted
  select pd.trusted_at is not null into v_is_trusted
    from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;
  if not coalesce(v_is_trusted, false) then return false; end if;

  with upd as (
    update public.players p set
      name               = coalesce(input_payload->>'name', p.name),
      email              = coalesce(input_payload->>'email', p.email),
      phone              = coalesce(input_payload->>'phone', p.phone),
      birthday           = coalesce(nullif(input_payload->>'birthday', '')::date, p.birthday),
      country            = coalesce(input_payload->>'country', p.country),
      gender             = coalesce(input_payload->>'gender', p.gender),
      is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      preferred_position = coalesce(input_payload->>'preferred_position', p.preferred_position),
      playtomic_level    = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjusted_level     = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level) + p.adjustment,
      playtomic_username = coalesce(input_payload->>'playtomic_username', p.playtomic_username),
      tagline            = coalesce(input_payload->>'tagline', p.tagline),
      tagline_label      = coalesce(input_payload->>'tagline_label', p.tagline_label),
      avatar_url         = coalesce(input_payload->>'avatar_url', p.avatar_url),
      playtomic_updated_at = case
        when (input_payload ? 'playtomic_level') then now()
        else p.playtomic_updated_at
      end
     where p.id = v_player_id
     returning 1
  ) select exists(select 1 from upd) into v_updated;

  return v_updated;
end;
$$;
revoke execute on function public.update_my_profile(text, text, jsonb) from public;
grant  execute on function public.update_my_profile(text, text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. admin_delete_player
-- ---------------------------------------------------------------------

create or replace function public.admin_delete_player(
  input_admin_pin   text,
  input_target_id   uuid,
  input_device_id   text default null,
  input_user_agent  text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
declare v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return false; end if;
  if input_target_id is null then return false; end if;

  with del as (
    delete from public.players p where p.id = input_target_id returning 1
  ) select exists(select 1 from del) into v_did_delete;

  if v_did_delete then
    insert into public.pin_attempts(
      player_id, device_id, user_agent, attempt_kind, succeeded
    ) values (
      input_target_id, input_device_id, input_user_agent, 'admin_action', true
    );
  end if;

  return v_did_delete;
end;
$$;
revoke execute on function public.admin_delete_player(text, uuid, text, text) from public;
grant  execute on function public.admin_delete_player(text, uuid, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. admin_regenerate_pin — returns the new PIN so admin can share it
-- ---------------------------------------------------------------------

create or replace function public.admin_regenerate_pin(
  input_admin_pin   text,
  input_target_id   uuid,
  input_device_id   text default null,
  input_user_agent  text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
declare
  v_new_pin text;
  v_updated boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return null; end if;
  if input_target_id is null then return null; end if;

  -- Generate fresh PIN, retry on collision with another active player
  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p
       where p.pin = v_new_pin
         and p.id <> input_target_id
         and coalesce(p.status,'active') = 'active'
    );
  end loop;

  with upd as (
    update public.players p set pin = v_new_pin where p.id = input_target_id returning 1
  ) select exists(select 1 from upd) into v_updated;

  if not v_updated then return null; end if;

  insert into public.pin_attempts(
    player_id, device_id, user_agent, attempt_kind, succeeded
  ) values (
    input_target_id, input_device_id, input_user_agent, 'admin_action', true
  );

  return v_new_pin;
end;
$$;
revoke execute on function public.admin_regenerate_pin(text, uuid, text, text) from public;
grant  execute on function public.admin_regenerate_pin(text, uuid, text, text) to anon, authenticated;


commit;

-- =====================================================================
-- Notes
--
-- After this migration, all four remaining direct-table writes on
-- public.players have RPC equivalents:
--   addPlayer       → admin_add_player
--   updatePlayer    → admin_update_player (admin) / update_my_profile (self)
--   deletePlayer    → admin_delete_player
--   regeneratePin   → admin_regenerate_pin
--
-- Direct from('players').insert/update/delete calls in app code still
-- work because we haven't REVOKE'd grants yet — that's the separate
-- 0009 migration, applied AFTER the app cuts over to the RPCs and is
-- confirmed working in production.
--
-- The pin_changes counter starts at 0 for every existing player. It
-- only begins incrementing when PINs are changed AFTER this migration
-- (the trigger sees TG_OP = 'UPDATE' with NEW.pin DISTINCT FROM OLD.pin).
--
-- All new RPCs run as the function owner (postgres) which is the table
-- owner, so they bypass RLS and continue to work after Phase 2c's
-- final REVOKE drops anon's direct grants.
-- =====================================================================
