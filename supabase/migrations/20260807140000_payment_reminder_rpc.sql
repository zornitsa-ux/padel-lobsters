-- Scoped, server-built WhatsApp payment reminder link.
--
-- Replaces the pattern of fetching the *entire* PII roster (email, phone,
-- birthday, notes, plaintext pin — get_all_players_with_pii_v2) just to read
-- one player's phone number for a reminder button. This RPC:
--   * takes a registration id, not a player id, so the caller can't be tricked
--     into requesting an arbitrary player's contact details unscoped from an
--     actual event/registration context,
--   * validates E.164 and builds the full wa.me URL server-side, mirroring
--     src/lib/whatsapp.ts's isE164()/buildDirectChatUrl() so a malformed
--     stored number (no country code, local format) yields NULL instead of a
--     link to the wrong recipient,
--   * returns the finished URL rather than the raw phone number, and audits
--     the read under its own attempt_kind (not 'pii_dump', which
--     AdminSecurityPanels labels "Full roster PII read" — this is neither
--     full-roster nor a raw-PII read).

alter table public.pin_attempts drop constraint if exists pin_attempts_attempt_kind_check;
alter table public.pin_attempts add constraint pin_attempts_attempt_kind_check
  check (attempt_kind = any(array[
    'player','admin','pii_dump','approve_device','admin_unlock','admin_action','signup','pin_reset',
    'payment_reminder'
  ]));

-- Percent-encodes a UTF-8 string the same way JS encodeURIComponent does:
-- everything except [A-Za-z0-9-_.~] becomes %XX. Needed because Postgres has
-- no built-in urlencode and the reminder message contains an emoji.
create or replace function public._url_encode(input text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  raw bytea := convert_to(input, 'UTF8');
  result text := '';
  b int;
begin
  for i in 0 .. octet_length(raw) - 1 loop
    b := get_byte(raw, i);
    if (b between 48 and 57) or (b between 65 and 90) or (b between 97 and 122)
       or b = 45 or b = 46 or b = 95 or b = 126 then
      result := result || chr(b);
    else
      result := result || '%' || upper(to_hex(b));
    end if;
  end loop;
  return result;
end;
$function$;

create or replace function public.get_payment_reminder_link(input_registration_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_player_id uuid;
  v_tournament_id uuid;
  v_player_name text;
  v_phone text;
  v_tournament_name text;
  v_tikkie_link text;
  v_digits text;
  v_message text;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();

  select r.player_id, r.tournament_id
    into v_player_id, v_tournament_id
    from public.registrations r
   where r.id = input_registration_id;

  if v_player_id is null then
    raise exception 'registration_not_found' using errcode = 'P0002';
  end if;

  select p.name, p.phone into v_player_name, v_phone
    from public.players p where p.id = v_player_id;

  select t.name, t.tikkie_link into v_tournament_name, v_tikkie_link
    from public.tournaments t where t.id = v_tournament_id;

  -- Audited unconditionally (the phone column was read either way), but
  -- `succeeded` records whether a usable link actually came out: the security
  -- panel renders this row as "Payment reminder sent", so a failed validation
  -- must not read as a send.
  if coalesce(v_tikkie_link, '') = '' then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return null;
  end if;

  v_digits := regexp_replace(coalesce(v_phone, ''), '[\s\-()]', '', 'g');
  if v_digits !~ '^\+\d{8,15}$' then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return null;
  end if;
  v_digits := regexp_replace(v_digits, '^\+', '');

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (v_player_id, 'payment_reminder', true);

  v_message := 'Hi ' || coalesce(nullif(v_player_name, ''), 'there')
    || '! Friendly reminder to pay for ' || coalesce(nullif(v_tournament_name, ''), 'the event')
    || ' via Tikkie: ' || v_tikkie_link || ' 🙏';

  return 'https://wa.me/' || v_digits || '?text=' || public._url_encode(v_message);
end;
$function$;

revoke execute on function public.get_payment_reminder_link(uuid) from public, anon;
grant execute on function public.get_payment_reminder_link(uuid) to authenticated;
revoke execute on function public._url_encode(text) from public, anon, authenticated;
