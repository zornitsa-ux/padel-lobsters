-- Admin invite / PIN reset hardening.
--
-- admin_invite_league_player only checked that the email was non-blank.
-- private.send_pin_email silently skips addresses that fail its format check,
-- so a typo activated the placeholder with a PIN nobody received, while the
-- admin saw "Invite sent!" — and the row could not be re-invited because it
-- was no longer a placeholder. A taken email surfaced as a raw unique
-- violation. Both now raise clear errors before anything changes.
--
-- The invite now returns the new PIN (as admin_regenerate_pin already does),
-- so the admin can pass it on if the email is slow or bounces. Both RPCs use
-- private.generate_unique_pin (20261012120000) so a PIN is never reissued.

create or replace function public.admin_invite_league_player(input_player_id uuid, input_email text)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_email  text := lower(nullif(btrim(input_email), ''));
  v_status text;
  v_pin    text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();

  if input_player_id is null or v_email is null then
    raise exception 'player_id and email are required' using errcode = '22023';
  end if;
  -- Same pattern private.send_pin_email requires, so a passing address is mailed.
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select status into v_status from public.players where id = input_player_id for update;
  if not found then
    raise exception 'player not found' using errcode = '22023';
  end if;
  if coalesce(v_status, 'active') <> 'placeholder' then
    raise exception 'player is not a placeholder' using errcode = '22023';
  end if;

  if exists (
       select 1 from public.players p
        where lower(btrim(p.email)) = v_email
          and coalesce(p.status, 'active') <> 'deleted'
          and p.id <> input_player_id
     )
     or exists (
       select 1 from auth.users u where lower(u.email) = v_email and u.id <> input_player_id
     ) then
    raise exception 'email in use' using errcode = '22023';
  end if;

  v_pin := private.generate_unique_pin();

  -- pin_hash is set by trg_sync_player_pin_hash; auth.users.email by players_email_sync.
  update public.players
     set email = v_email, status = 'active', pin = v_pin
   where id = input_player_id;

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (input_player_id, 'admin_action', true);

  perform private.send_pin_email(input_player_id, v_pin, 'new_signup');
  return v_pin;
end;
$function$;

create or replace function public.admin_regenerate_pin(input_target_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_pin   text;
  v_email text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_target_id is null then return null; end if;

  v_pin := private.generate_unique_pin();

  update public.players p
     set pin = v_pin
   where p.id = input_target_id
  returning p.email into v_email;
  if not found then return null; end if;

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (input_target_id, 'admin_action', true);

  if v_email is not null and length(trim(v_email)) > 3 then
    perform private.send_pin_email(input_target_id, v_pin, 'regenerated');
  end if;
  return v_pin;
end
$function$;
