-- =====================================================================
-- Padel Lobsters — Self-serve signup RPC
-- =====================================================================
-- Production was broken: SignupRequest.jsx wires the "Join the Lobsters"
-- form to AppContext.addPlayer, which gates on the admin PIN and calls
-- admin_add_player. Result: every brand-new user got "Admin sign-in
-- required to add a player." and could not create a profile.
--
-- The frontend already had a `selfSignup` wrapper around an RPC named
-- `self_signup_player`, but no migration had ever created that RPC.
-- This file adds it. The companion frontend patch routes
-- SignupRequest.jsx through `selfSignup` so the admin gate is no longer
-- on the new-user path.
--
-- Design choices:
--   * SECURITY DEFINER, locked search_path — same shape as
--     admin_add_player. Anon EXECUTE granted explicitly; PUBLIC revoked.
--   * Server-side 4-digit PIN generation with collision retry against
--     active players, mirroring admin_add_player so PINs stay unique.
--   * The pin_hash trigger sync_player_pin_hash hashes on INSERT, so we
--     just write the plaintext PIN like admin_add_player does.
--   * Duplicate-email guard: returns was_existing=true with NO pin/id
--     when the email already belongs to an active player. The form
--     surfaces a "use Forgot my PIN" message — we never disclose an
--     existing PIN purely on the strength of an email match.
--   * Per-device rate limit: 5 successful signups in a rolling 24h.
--     device_id is client-supplied and trivially rotated, so this is a
--     speed-bump, not a real defense — just enough to stop accidental
--     spam from a runaway form.
--   * pin_attempts CHECK constraint widened to include 'signup' so the
--     audit row from this RPC is captured under its real kind.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Allow 'signup' as a pin_attempts kind so we can log self-signups
--    distinctly from admin actions.
-- ---------------------------------------------------------------------

alter table public.pin_attempts
  drop constraint if exists pin_attempts_attempt_kind_check;

alter table public.pin_attempts
  add constraint pin_attempts_attempt_kind_check
  check (attempt_kind = any (array[
    'player'::text,
    'admin'::text,
    'pii_dump'::text,
    'approve_device'::text,
    'admin_unlock'::text,
    'admin_action'::text,
    'signup'::text
  ]));


-- ---------------------------------------------------------------------
-- 2. self_signup_player — anon-callable, no admin PIN required.
-- ---------------------------------------------------------------------

create or replace function public.self_signup_player(
  input_payload     jsonb,
  input_device_id   text default null,
  input_user_agent  text default null
)
returns table (
  player_id    uuid,
  pin          text,
  was_existing boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
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

  -- Per-device speed-bump. Logs that didn't succeed still count so a
  -- form spam loop trips the limit even if every attempt errors out.
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

  -- Duplicate-email guard. We only consider active players so a
  -- previously-removed email can sign up again, but a current member
  -- can't be re-created behind their back.
  select p.id into v_existing_id
    from public.players p
   where lower(coalesce(p.email,'')) = v_email
     and coalesce(p.status,'active') = 'active'
   limit 1;

  if v_existing_id is not null then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_existing_id, input_device_id, input_user_agent, 'signup', false);
    -- Surface "this email already exists" without disclosing the PIN.
    -- Caller should route the user to the Forgot-my-PIN flow.
    return query select null::uuid, null::text, true;
    return;
  end if;

  -- Generate a fresh 4-digit PIN. Same retry shape as admin_add_player.
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
$$;


-- ---------------------------------------------------------------------
-- 3. Grants — anon must EXECUTE; nobody else needs to.
-- ---------------------------------------------------------------------

revoke all on function public.self_signup_player(jsonb, text, text) from public;
grant execute on function public.self_signup_player(jsonb, text, text) to anon;

commit;
