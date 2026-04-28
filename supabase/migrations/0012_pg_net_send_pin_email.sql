-- Migration 0012 — wire pg_net + private.send_pin_email wrapper
--
-- Purpose: lets SECURITY DEFINER RPCs (admin_add_player, admin_regenerate_pin,
-- forgot_my_pin, etc.) hand off the freshly-generated plaintext PIN to the
-- send-pin-email Edge Function. The plaintext never leaves Postgres -> Edge
-- Function over HTTPS — it never traverses the JS client and never enters
-- the public PostgREST API.
--
-- Architecture:
--   private.send_pin_email(player_id, pin, kind)
--     -> reads players.email + players.name
--     -> reads vault secret 'edge_send_pin_service_role' (= the project's
--        service-role key, stored once via the dashboard or one-shot SQL)
--     -> POSTs to https://<project>.supabase.co/functions/v1/send-pin-email
--        via pg_net (async; returns the request_id for inspection)
--   The Edge Function authenticates the call by comparing the bearer token
--   to its SUPABASE_SERVICE_ROLE_KEY env var.
--
-- Operational note: this migration installs the rail. Until you deploy the
-- send-pin-email Edge Function AND insert the service-role key into
-- vault.secrets under the name 'edge_send_pin_service_role', no email is
-- actually sent — calling the wrapper will either no-op (no vault secret)
-- or queue a request that 401s at the function. Both are recoverable.

-- 1) Enable pg_net so Postgres can make outbound HTTP calls.
create extension if not exists pg_net with schema extensions;

-- 2) Helper to fetch the service-role key out of vault. Lives in private
--    so it's not exposed via PostgREST, and runs SECURITY DEFINER so callers
--    don't need direct grants on the vault schema.
create or replace function private.get_edge_service_role_key()
returns text
language sql
security definer
set search_path = pg_catalog, vault, extensions
as $$
  select decrypted_secret
    from vault.decrypted_secrets
   where name = 'edge_send_pin_service_role'
   limit 1;
$$;

revoke all on function private.get_edge_service_role_key() from public;
revoke all on function private.get_edge_service_role_key() from anon, authenticated;

-- 3) The wrapper itself. Returns the pg_net request_id (bigint), or null if
--    the player has no email on file. Raises if vault hasn't been set up.
--
--    Fire-and-forget: pg_net queues the request and a background worker
--    delivers it within a few seconds. To inspect a specific result later:
--        select * from net._http_response where id = <request_id>;
create or replace function private.send_pin_email(
  input_player_id uuid,
  input_pin       text,
  input_kind      text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, net
as $$
declare
  v_email      text;
  v_name       text;
  v_key        text;
  v_url        text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-pin-email';
  v_request_id bigint;
begin
  if input_kind not in ('new_signup', 'regenerated', 'forgot_reset') then
    raise exception 'send_pin_email: invalid kind: %', input_kind;
  end if;
  if input_pin is null or input_pin !~ '^\d{4,8}$' then
    raise exception 'send_pin_email: invalid pin format';
  end if;

  select email, name
    into v_email, v_name
    from public.players
   where id = input_player_id
   limit 1;

  -- No usable email on file: silently no-op. Callers (e.g. forgot_my_pin)
  -- always return a generic ok regardless, so this doesn't leak whether
  -- the email exists.
  if v_email is null or length(trim(v_email)) < 3 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return null;
  end if;

  v_key := private.get_edge_service_role_key();
  if v_key is null then
    raise exception 'send_pin_email: vault secret edge_send_pin_service_role is missing — see migration 0012 deployment notes';
  end if;

  select net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
      'player_id', input_player_id::text,
      'email',     v_email,
      'name',      v_name,
      'pin',       input_pin,
      'kind',      input_kind
    ),
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || v_key,
      'content-type',  'application/json'
    ),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.send_pin_email(uuid, text, text) from public;
revoke all on function private.send_pin_email(uuid, text, text) from anon, authenticated;
grant  execute on function private.send_pin_email(uuid, text, text) to postgres, service_role;
