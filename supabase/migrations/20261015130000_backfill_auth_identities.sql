-- Give every auth user the email identity GoTrue would have created
-- (docs/pin-auth-removal F-5, PLAN T0b).
--
-- ensure_auth_user_for_player inserts into auth.users directly, so those users
-- have no auth.identities row and app_metadata.providers is missing or []. The
-- admin email edit (players_email_sync) likewise rewrites auth.users.email
-- without touching the identity, and the 20261012140000 email restore left
-- identities holding player-<id>@padelobsters.internal while auth.users has
-- the real address.
--
-- private.sync_email_identity mirrors a GoTrue-created row: provider 'email',
-- provider_id = sub = user id, identity_data {sub, email, email_verified,
-- phone_verified}, app_metadata {provider: 'email', providers: ['email']}.
-- It is applied once to every user, then called from both triggers.

create or replace function private.sync_email_identity(input_user_id uuid)
returns void
language sql
set search_path = pg_catalog
as $$
  insert into auth.identities
    (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id::text,
         u.id,
         jsonb_build_object(
           'sub', u.id::text,
           'email', u.email,
           'email_verified', u.email_confirmed_at is not null,
           'phone_verified', false
         ),
         'email',
         u.last_sign_in_at,
         now(),
         now()
    from auth.users u
   where u.id = input_user_id
  on conflict (provider_id, provider) do update
     set identity_data = auth.identities.identity_data
                         || jsonb_build_object('email', excluded.identity_data ->> 'email'),
         updated_at    = now()
   where auth.identities.identity_data ->> 'email'
         is distinct from excluded.identity_data ->> 'email';

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || '{"provider": "email", "providers": ["email"]}'::jsonb
   where id = input_user_id
     and coalesce(raw_app_meta_data -> 'providers', '[]'::jsonb) = '[]'::jsonb;
$$;

revoke all on function private.sync_email_identity(uuid) from public, anon, authenticated;

do $$ begin perform private.sync_email_identity(id) from auth.users; end $$;


-- Unchanged apart from the sync_email_identity call.
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

  perform private.sync_email_identity(NEW.id);

  return NEW;
end;
$$;


-- Unchanged apart from the sync_email_identity call.
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
      perform private.sync_email_identity(NEW.id);
    end if;
  end if;
  return NEW;
end;
$$;
