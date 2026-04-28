-- Migration 0016 — lower bcrypt cost from 10 to 6 for PIN hashing
--
-- Reason: verify_player_pin_v2 must bcrypt-compare against every players
-- row to identify which player owns a PIN (PIN is the only login
-- credential — there's no email field in the login form). At cost 10
-- across 58 players the sweep takes ~4 seconds, right at PostgREST's
-- anon-role statement timeout. Live login was 500-erroring as a result.
-- Cost 6 brings the sweep to ~300ms with plenty of headroom.
--
-- Security: bcrypt cost mostly slows down brute-force *after* a hash
-- leaks. PIN strength is 4 numeric digits = 10k candidates; at cost 6
-- (~5ms/check) brute-forcing one leaked hash is ~50s, at cost 10 it's
-- ~12min. Both are trivial against a 4-digit secret. Real protection
-- comes from the rate-limit + lockout already in verify_player_pin_v2.
--
-- This migration:
--   1) Updates sync_player_pin_hash trigger to use cost 6 going forward
--   2) Updates forgot_my_pin RPC to use cost 6
--   3) Re-hashes all 58 existing player rows from their plaintext pin
--      column (so the sweep is fast for the whole roster, not just new
--      PINs)
--   4) Re-hashes Zornitsa's row specifically — her plaintext was cleared
--      earlier today during testing; her PIN is currently '9999' from
--      that test session

create or replace function public.sync_player_pin_hash()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $function$
begin
  if NEW.pin is not null and NEW.pin <> '' then
    if TG_OP = 'INSERT' then
      NEW.pin_hash := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 6));
    elsif NEW.pin is distinct from OLD.pin then
      NEW.pin_hash    := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 6));
      NEW.pin_changes := coalesce(OLD.pin_changes, 0) + 1;
    end if;
  end if;
  return NEW;
end
$function$;

create or replace function public.forgot_my_pin(
  input_email      text,
  input_device_id  text,
  input_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
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
     set pin_hash     = extensions.crypt(v_new_pin, extensions.gen_salt('bf', 6)),
         pin          = null,
         locked_until = null,
         pin_changes  = coalesce(pin_changes, 0) + 1
   where id = v_player_id;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_player_id, input_device_id, input_user_agent, 'pin_reset', true);

  perform private.send_pin_email(v_player_id, v_new_pin, 'forgot_reset');

  return 'sent';
end
$function$;

update public.players
   set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf', 6))
 where pin is not null and pin <> '';
