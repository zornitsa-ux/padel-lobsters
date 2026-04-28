-- Migration 0013 — forgot_my_pin RPC for self-service PIN reset via email
--
-- Anon-callable. Player enters their email, we find their row, generate a
-- new 4-digit PIN, hash it into pin_hash, clear the plaintext pin column,
-- and email the new PIN via the send-pin-email Edge Function.
--
-- If the email isn't on file (player didn't provide one at signup, or
-- typed it wrong), we return 'contact_admin' so the UI can route them to
-- WhatsApp instead of revealing whether the email exists.
--
-- Rate-limited at 3 successful resets per player per 24h so a hostile
-- actor can't flood a player's inbox or burn through PIN regenerations.

create or replace function public.forgot_my_pin(
  input_email      text,
  input_device_id  text,
  input_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_player_id uuid;
  v_new_pin   text;
  v_recent_resets int;
  c_max_per_player_24h constant int := 3;
begin
  set local statement_timeout = '30s';

  if input_email is null or trim(input_email) = ''
     or input_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'invalid';
  end if;
  if input_device_id is null or trim(input_device_id) = '' then
    return 'invalid';
  end if;

  select p.id into v_player_id
    from public.players p
   where lower(trim(p.email)) = lower(trim(input_email))
     and coalesce(p.status, 'active') = 'active'
   limit 1;

  if v_player_id is null then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'pin_reset', false);
    return 'contact_admin';
  end if;

  select count(*) into v_recent_resets
    from public.pin_attempts pa
   where pa.player_id = v_player_id
     and pa.attempt_kind = 'pin_reset'
     and pa.succeeded = true
     and pa.attempted_at > now() - interval '24 hours';

  if v_recent_resets >= c_max_per_player_24h then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_player_id, input_device_id, input_user_agent, 'pin_reset', false);
    return 'rate_limited';
  end if;

  v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');

  update public.players
     set pin_hash     = extensions.crypt(v_new_pin, extensions.gen_salt('bf', 10)),
         pin          = null,
         locked_until = null,
         pin_changes  = coalesce(pin_changes, 0) + 1
   where id = v_player_id;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_player_id, input_device_id, input_user_agent, 'pin_reset', true);

  perform private.send_pin_email(v_player_id, v_new_pin, 'forgot_reset');

  return 'sent';
end;
$$;

revoke all on function public.forgot_my_pin(text, text, text) from public;
grant execute on function public.forgot_my_pin(text, text, text) to anon, authenticated;
