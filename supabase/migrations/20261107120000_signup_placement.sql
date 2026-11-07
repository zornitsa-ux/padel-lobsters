-- Growth G5: where in the app the link that brought a new player was shared
-- from (the utm_content of a `utm_source=share` link), recorded once at signup.
-- Nothing else about the visit is kept.
--
-- The value arrives as signup metadata (`share_placement`), so it's untrusted:
-- the trigger keeps it only in the placement format and stores null otherwise.
-- A bad value never blocks a signup, so the before_user_created hook is
-- unchanged. Clients have column-level SELECT on players (id, name,
-- avatar_url, status) and no UPDATE, so the column is read by admins (SQL) and
-- by the player's own profile RPC only.

alter table public.players
  add column signup_placement text
    constraint players_signup_placement_format
      check (signup_placement ~ '^[a-z0-9-]{1,30}$');

comment on column public.players.signup_placement is
  'Growth G5: app placement of the shared link that led to this signup (utm_content), or null.';

create or replace function private.parse_metadata_placement(input_text text)
 returns text
 language sql
 immutable
 set search_path to 'pg_catalog'
as $function$
  select case when input_text ~ '^[a-z0-9-]{1,30}$' then input_text end
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
  v_placement text := private.parse_metadata_placement(v_meta ->> 'share_placement');
begin
  if v_name is null or nullif(btrim(new.email), '') is null then
    return new;
  end if;

  -- An email already held by another player (case-insensitive) must not abort
  -- GoTrue's confirmation; the integrity check reports the user instead.
  begin
    insert into public.players(
      id, name, email, phone, notes,
      playtomic_level, adjustment, adjusted_level,
      playtomic_username, gender, status, is_left_handed,
      country, birthday, preferred_position, tagline_label, pin, pin_hash,
      signup_placement
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
      null,
      v_placement
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    return new;
  end;

  return new;
end;
$function$;

revoke all on function private.parse_metadata_placement(text) from public, anon, authenticated;
revoke all on function private.create_player_for_confirmed_user() from public, anon, authenticated;
