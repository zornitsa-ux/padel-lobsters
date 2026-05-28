-- =============================================================================
--  Magic-link auth foundation + email lifecycle + auth.users 1:1 invariant.
--
--  This single migration replaces the four staging migrations in which this
--  feature was originally built up iteratively (squashed pre-merge — see PR
--  description for the iterative history if you need it). Net behaviour is
--  identical to applying those four in sequence:
--
--   * `custom_access_token_hook` — JWT claim hook, single source of truth
--     for `role` and `device_trusted`. Fires on every token issuance (PIN
--     sign-in, magic link, future OAuth, every refresh).
--
--   * `bootstrap_device_session` — post-sign-in RPC for magic-link / OAuth
--     flows (PIN flow has its own device ceremony inside verify-pin).
--     Registers the device, applies the auto-trust grace rule, and
--     snapshots `role` + `device_trusted` + `device_id` into
--     `auth.users.raw_app_meta_data` so `session.user.app_metadata`
--     reflects them (the JWT claim hook keeps the live token in sync, but
--     the SDK's User object reads the raw_app_meta_data column).
--
--   * Bidirectional email sync: writing to either side
--     (players.email or auth.users.email) propagates to the other,
--     with cycle guards on each direction. Players.email is the
--     human-facing field; auth.users.email is the auth-identity field.
--
--   * `ensure_auth_user_for_player` — INSERT trigger on public.players so
--     every player has a matching auth.users row from creation. Plus a
--     one-time backfill for existing players.
--
--   * Token-column safety: GoTrue v2.189 scans
--     `confirmation_token`, `recovery_token`, `email_change_token_new`,
--     and `email_change` as Go strings, NOT sql.NullString — a NULL in
--     any of them throws 500 "Database error finding user". We default
--     them to '' on insert and coerce any pre-existing NULLs to ''.
--
--   * `update_my_profile` no longer accepts an email field — self-service
--     email change goes through `supabase.auth.updateUser`, which is
--     confirmation-gated. Admin email edits go through admin_update_player
--     (the trigger mirrors them to auth.users).
--
--   * `forgot_my_pin` is dropped — magic-link recovery replaces it.
-- =============================================================================


-- ---------------------------------------------------------------------
-- 0. Defensive cleanup of paths that were prototyped during development.
--    Safe on a fresh DB (no-ops); idempotent on a DB where a partial
--    in-progress migration ran.
-- ---------------------------------------------------------------------
drop function if exists public.forgot_my_pin(text, text, text);
drop function if exists public.admin_set_player_email(uuid, text);
drop function if exists public.request_my_email_change(text);


-- ---------------------------------------------------------------------
-- 1. Uniqueness on players.email (case-insensitive, partial — NULL ok).
-- ---------------------------------------------------------------------
create unique index if not exists players_email_lower_unique
  on public.players (lower(email))
  where email is not null and email <> '';


-- ---------------------------------------------------------------------
-- 2. custom_access_token_hook
--
-- Supabase Auth calls this on every JWT issuance. We:
--   * Set app_metadata.role from players.role (live — no stale admin).
--   * Re-derive app_metadata.device_trusted from player_devices, keyed
--     on whichever device_id is already in app_metadata.
--   * Leave app_metadata.device_id alone (set by verify-pin or by
--     bootstrap_device_session).
--
-- IMPORTANT: this hook MUST be enabled in supabase/config.toml
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
-- and toggled on in the production dashboard. Until enabled, this
-- function is dead code and existing behaviour is unchanged.
-- ---------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id   uuid;
  v_claims    jsonb;
  v_app_meta  jsonb;
  v_role      text;
  v_device_id text;
  v_trusted   boolean;
begin
  v_user_id  := (event->>'user_id')::uuid;
  v_claims   := event->'claims';
  v_app_meta := coalesce(v_claims->'app_metadata', '{}'::jsonb);

  -- Look up live role. Missing player row → leave role unset (treated as 'guest' by the client).
  select role::text into v_role from public.players where id = v_user_id;
  if v_role is not null then
    v_app_meta := jsonb_set(v_app_meta, '{role}', to_jsonb(v_role));
  end if;

  -- Live-derive device_trusted from player_devices.
  v_device_id := v_app_meta->>'device_id';
  if v_device_id is not null then
    select (trusted_at is not null) into v_trusted
      from public.player_devices
      where player_id = v_user_id and device_id = v_device_id;
    v_app_meta := jsonb_set(v_app_meta, '{device_trusted}', to_jsonb(coalesce(v_trusted, false)));
  else
    v_app_meta := jsonb_set(v_app_meta, '{device_trusted}', 'false'::jsonb);
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_meta);
  return jsonb_build_object('claims', v_claims);
end;
$$;

-- The hook is invoked by the supabase_auth_admin role. It needs read
-- access to the two tables we look up.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.players         to supabase_auth_admin;
grant select on public.player_devices  to supabase_auth_admin;

-- Defense in depth: keep it off PUBLIC.
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. bootstrap_device_session
--
-- Called by the client immediately after a magic-link (or future OAuth)
-- sign-in completes. Registers the device, applies the auto-trust grace
-- rule, and snapshots role + device_trusted + device_id into
-- raw_app_meta_data so session.user.app_metadata reflects them.
--
-- session.user.app_metadata is sourced from raw_app_meta_data, NOT
-- from the JWT claims the access-token hook modifies — so writing the
-- snapshot here is what makes VerificationGate read role==='player'
-- after a magic-link sign-in. The hook still owns liveness on
-- subsequent token refreshes.
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_device_session(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id           uuid;
  v_auto_trust_until  timestamptz;
  v_existing_trusted  int;
  v_should_trust      boolean;
  v_role              text;
  v_trusted           boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'invalid device_id';
  end if;

  select role::text into v_role from public.players where id = v_user_id;
  if v_role is null then
    raise exception 'no player record for this user';
  end if;

  select auto_trust_until into v_auto_trust_until from public.settings limit 1;
  select count(*) into v_existing_trusted
    from public.player_devices
    where player_id = v_user_id and trusted_at is not null;

  v_should_trust := (v_existing_trusted = 0
                     and v_auto_trust_until is not null
                     and v_auto_trust_until > now());

  insert into public.player_devices (player_id, device_id, trusted_at, first_seen, last_seen)
  values (v_user_id, p_device_id,
          case when v_should_trust then now() else null end,
          now(), now())
  on conflict (player_id, device_id) do update
    set last_seen = now(),
        trusted_at = coalesce(public.player_devices.trusted_at,
                              case when v_should_trust then now() else null end);

  select trusted_at is not null into v_trusted
    from public.player_devices
    where player_id = v_user_id and device_id = p_device_id;

  update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                            || jsonb_build_object(
                              'device_id',      p_device_id,
                              'role',           v_role,
                              'device_trusted', coalesce(v_trusted, false)
                            )
    where id = v_user_id;

  return jsonb_build_object(
    'device_id', p_device_id,
    'trusted',   coalesce(v_trusted, false)
  );
end;
$$;

grant execute on function public.bootstrap_device_session(text) to authenticated;
revoke execute on function public.bootstrap_device_session(text) from public, anon;


-- ---------------------------------------------------------------------
-- 4. Bidirectional email-sync triggers.
--
-- Each trigger function guards against the cyclic update by requiring
-- the target side to actually differ before writing. With this in place,
-- writing to either side reaches a fixed point in two trigger fires:
--   write players.email -> trigger A fires -> updates auth.users.email
--      -> trigger B fires -> sees players.email already matches -> no-op.
-- ---------------------------------------------------------------------
create or replace function public.sync_player_email_to_auth()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target text;
begin
  if NEW.email is distinct from OLD.email then
    select email into v_target from auth.users where id = NEW.id;
    if v_target is distinct from NEW.email then
      if NEW.email is null then
        -- Admin cleared the player's email. Don't NULL out auth.users.email
        -- (it's NOT NULL and serves as the auth identity). Restore the
        -- synthetic address so the row keeps a stable, unique email and
        -- verify-pin's generate_link still has something to look up.
        update auth.users
          set email = format('player-%s@padelobsters.internal', NEW.id::text),
              email_confirmed_at = coalesce(email_confirmed_at, now())
          where id = NEW.id;
      else
        update auth.users
          set email = NEW.email,
              email_confirmed_at = coalesce(email_confirmed_at, now())
          where id = NEW.id;
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists players_email_sync on public.players;
create trigger players_email_sync
after update of email on public.players
for each row
execute function public.sync_player_email_to_auth();


create or replace function public.sync_auth_email_to_player()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target  text;
  v_clean   text;
begin
  if NEW.email is distinct from OLD.email then
    -- Synthetic addresses should never propagate back to players.email —
    -- they're an auth-identity bookkeeping value, not a real contact.
    if NEW.email like 'player-%@padelobsters.internal' then
      return NEW;
    end if;
    v_clean := lower(btrim(NEW.email));
    select email into v_target from public.players where id = NEW.id;
    if lower(coalesce(v_target, '')) is distinct from v_clean then
      update public.players
        set email = v_clean
        where id = NEW.id;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists auth_users_email_sync on auth.users;
create trigger auth_users_email_sync
after update of email on auth.users
for each row
execute function public.sync_auth_email_to_player();

-- The auth.users trigger function is invoked under the role that issued
-- the UPDATE (usually supabase_auth_admin during a confirmed email
-- change). SECURITY DEFINER means it runs as the migration owner, so
-- we need to make sure the owner has the write privileges. Postgres
-- migration owner is usually 'postgres' which already has full DML on
-- public — no extra grants needed. Belt-and-braces:
grant insert, update on public.players to supabase_auth_admin;


-- ---------------------------------------------------------------------
-- 5. ensure_auth_user_for_player — INSERT trigger on public.players so
--    every player has a matching auth.users row from creation. Without
--    this, magic-link sign-in (which uses `shouldCreateUser: false`)
--    fails with "Signups not allowed for otp" for players who've never
--    signed in via PIN.
--
--    NOTE on the empty-string columns below: GoTrue v2.189's row scanner
--    reads `confirmation_token`, `recovery_token`,
--    `email_change_token_new`, and `email_change` as Go `string` (not
--    `sql.NullString`), so a NULL in any of them produces 500
--    "Database error finding user" the moment auth touches the row
--    (e.g. on signInWithOtp). Postgres defaults cover most token
--    columns; these four don't and must be set explicitly.
-- ---------------------------------------------------------------------
create or replace function public.ensure_auth_user_for_player()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text;
begin
  v_email := coalesce(
    nullif(btrim(NEW.email), ''),
    format('player-%s@padelobsters.internal', NEW.id::text)
  );

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    NEW.id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    now(),
    '',
    '',
    '',
    '',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists ensure_auth_user on public.players;
create trigger ensure_auth_user
after insert on public.players
for each row
execute function public.ensure_auth_user_for_player();


-- ---------------------------------------------------------------------
-- 6. update_my_profile — same as before but with the email field stripped.
--
-- Players can no longer change their own email via the profile-save
-- RPC — that path skipped Supabase's confirmation step and would have
-- let anyone with a trusted device silently re-bind the account to a
-- different address. Self-service email change now goes through
-- supabase.auth.updateUser, which sends a confirmation link to the new
-- address; the auth_users_email_sync trigger mirrors it back to
-- players.email on success.
-- ---------------------------------------------------------------------
create or replace function public.update_my_profile(input_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_player_id uuid;
  v_updated boolean := false;
begin
  set local statement_timeout = '30s';
  v_player_id := auth.uid();
  if v_player_id is null or input_payload is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform public.require_trusted_device();
  with upd as (
    update public.players p set
      name                  = case when input_payload ? 'name'               then nullif(btrim(input_payload->>'name'), '')               else p.name end,
      -- email is INTENTIONALLY OMITTED — see function header.
      phone                 = case when input_payload ? 'phone'              then nullif(btrim(input_payload->>'phone'), '')              else p.phone end,
      birthday              = case when input_payload ? 'birthday'           then nullif(input_payload->>'birthday', '')::date            else p.birthday end,
      country               = case when input_payload ? 'country'            then nullif(btrim(input_payload->>'country'), '')            else p.country end,
      gender                = case when input_payload ? 'gender'             then nullif(btrim(input_payload->>'gender'), '')             else p.gender end,
      is_left_handed        = coalesce((input_payload->>'is_left_handed')::boolean,             p.is_left_handed),
      preferred_position    = case when input_payload ? 'preferred_position' then nullif(btrim(input_payload->>'preferred_position'), '') else p.preferred_position end,
      playtomic_level       = coalesce((input_payload->>'playtomic_level')::numeric,            p.playtomic_level),
      adjusted_level        = coalesce((input_payload->>'playtomic_level')::numeric,            p.playtomic_level) + p.adjustment,
      playtomic_username    = case when input_payload ? 'playtomic_username' then nullif(btrim(input_payload->>'playtomic_username'), '') else p.playtomic_username end,
      tagline               = case when input_payload ? 'tagline'            then nullif(btrim(input_payload->>'tagline'), '')            else p.tagline end,
      tagline_label         = case when input_payload ? 'tagline_label'      then nullif(btrim(input_payload->>'tagline_label'), '')      else p.tagline_label end,
      avatar_url            = case when input_payload ? 'avatar_url'         then nullif(btrim(input_payload->>'avatar_url'), '')         else p.avatar_url end,
      playtomic_updated_at  = case when (input_payload ? 'playtomic_level')
                                   then now()
                                   else p.playtomic_updated_at end
    where p.id = v_player_id
    returning 1
  ) select exists (select 1 from upd) into v_updated;
  return v_updated;
end
$function$;


-- ---------------------------------------------------------------------
-- 7. One-time backfills. Idempotent: re-running this migration on an
--    already-migrated DB is a no-op.
--
--    Order matters:
--    a) Create the missing auth.users rows first (with '' tokens, real
--       or synthetic email).
--    b) Then bring existing rows up to date: token-column NULL → '',
--       email mirrored from players.email, raw_app_meta_data.role
--       snapshot populated. These all key off players, so doing them
--       after (a) ensures we touch every auth.users row exactly once.
-- ---------------------------------------------------------------------

-- a) auth.users rows for players without one.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  p.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  coalesce(
    nullif(btrim(p.email), ''),
    format('player-%s@padelobsters.internal', p.id::text)
  ),
  now(),
  '',
  '',
  '',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  coalesce(p.created_at, now()),
  now()
from public.players p
left join auth.users u on u.id = p.id
where u.id is null;

-- b) Coerce NULL token columns on any pre-existing rows. New rows from
--    (a) already have '' set explicitly.
update auth.users
set confirmation_token     = coalesce(confirmation_token, ''),
    recovery_token         = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change           = coalesce(email_change, '')
where confirmation_token     is null
   or recovery_token         is null
   or email_change_token_new is null
   or email_change           is null;

-- c) Mirror players.email -> auth.users.email where there's a real
--    email on file. (Existing rows may have been left on synthetic
--    addresses by verify-pin's older code path.)
update auth.users u
  set email = p.email,
      email_confirmed_at = coalesce(u.email_confirmed_at, now())
  from public.players p
  where u.id = p.id
    and p.email is not null
    and p.email <> ''
    and u.email <> p.email;

-- d) Snapshot players.role into raw_app_meta_data so session.user.app_metadata
--    reflects it on first sign-in (the access-token hook keeps the JWT live
--    on every refresh; this seeds the SDK-visible User object).
update auth.users u
  set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', p.role::text)
  from public.players p
  where u.id = p.id
    and coalesce(u.raw_app_meta_data->>'role', '') <> p.role::text;
