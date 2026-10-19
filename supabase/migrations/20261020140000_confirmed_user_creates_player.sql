-- A confirmed auth user gets a players row (docs/pin-auth-removal C-4).
--
-- Native signup creates the auth user first (the before_user_created hook has
-- validated its metadata), so the player row follows when the address is
-- confirmed: on insert if GoTrue creates the user already confirmed, or on the
-- update that sets email_confirmed_at after the code is verified.
--
-- Idempotent with the reverse path: ensure_auth_user_for_player inserts a
-- confirmed auth user for every new player, but the player row exists by then,
-- so on conflict (id) does nothing. The insert here fires that function in
-- turn, which no-ops on the existing auth user. Synthetic addresses never
-- reach this trigger as an insert without a player row.
--
-- Users without a usable name (created outside signup, e.g. an admin API call)
-- are skipped rather than failing the confirmation.

create or replace function private.parse_metadata_level(input_text text)
 returns numeric
 language sql
 immutable
 set search_path to 'pg_catalog'
as $function$
  select case
    when replace(btrim(coalesce(input_text, '')), ',', '.') ~ '^\d+(\.\d+)?$'
      then replace(btrim(input_text), ',', '.')::numeric
    else 0
  end
$function$;

create or replace function private.parse_metadata_date(input_text text)
 returns date
 language plpgsql
 immutable
 set search_path to 'pg_catalog'
as $function$
begin
  return nullif(btrim(coalesce(input_text, '')), '')::date;
exception when others then
  return null;
end;
$function$;

create or replace function private.create_player_for_confirmed_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name  text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_level numeric := private.parse_metadata_level(v_meta ->> 'playtomic_level');
begin
  if v_name is null or nullif(btrim(new.email), '') is null then
    return new;
  end if;

  insert into public.players(
    id, name, email, phone, notes,
    playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed,
    country, birthday, preferred_position, tagline_label, pin, pin_hash
  ) values (
    new.id,
    left(v_name, 100),
    lower(new.email),
    coalesce(nullif(btrim(v_meta ->> 'phone'), ''), ''),
    coalesce(v_meta ->> 'notes', ''),
    v_level,
    0,
    v_level,
    coalesce(v_meta ->> 'playtomic_username', ''),
    coalesce(v_meta ->> 'gender', ''),
    'active',
    coalesce(v_meta ->> 'is_left_handed', '') = 'true',
    coalesce(v_meta ->> 'country', ''),
    private.parse_metadata_date(v_meta ->> 'birthday'),
    coalesce(v_meta ->> 'preferred_position', ''),
    coalesce(v_meta ->> 'tagline_label', ''),
    null,
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function private.parse_metadata_level(text) from public, anon, authenticated;
revoke all on function private.parse_metadata_date(text) from public, anon, authenticated;
revoke all on function private.create_player_for_confirmed_user() from public, anon, authenticated;

create trigger create_player_on_confirmed_insert
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function private.create_player_for_confirmed_user();

create trigger create_player_on_confirmation
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.create_player_for_confirmed_user();
