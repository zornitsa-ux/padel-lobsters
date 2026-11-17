-- ============================================================================
-- Signup revamp S4: "How did you find us" (docs/signup-revamp/ C-5, D-10).
--
-- The signup form sends an optional signup_source (and, for lobster/other, a
-- free-text detail) in user_metadata. before_user_created_hook validates it;
-- create_player_for_confirmed_user stores it once the player row exists.
-- Both functions are re-created from 20261020130000 / 20261020140000; only the
-- signup-source parts are new.
-- ============================================================================

-- ── 1. player_signup_source (C-5) ───────────────────────────────────────────
-- Admin-read only, like player_levelling. Written only by the trigger below.
create table public.player_signup_source (
  player_id  uuid primary key references public.players(id) on delete cascade,
  source     text not null check (source in ('lobster', 'instagram', 'plaza_whatsapp', 'other')),
  detail     text check (char_length(detail) between 1 and 100),
  created_at timestamptz not null default now(),
  constraint player_signup_source_detail_kind
    check (detail is null or source in ('lobster', 'other'))
);

alter table public.player_signup_source enable row level security;

create policy player_signup_source_admin_read on public.player_signup_source
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.player_signup_source to authenticated;

-- ── 2. Hook: validate the two keys (C-5) ────────────────────────────────────
create or replace function public.before_user_created_hook(event jsonb)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_meta   jsonb := coalesce(event -> 'user' -> 'user_metadata', '{}'::jsonb);
  v_name   text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_level  text  := replace(btrim(coalesce(v_meta ->> 'playtomic_level', '')), ',', '.');
  v_source text  := nullif(btrim(coalesce(v_meta ->> 'signup_source', '')), '');
  v_detail text  := btrim(coalesce(v_meta ->> 'signup_source_detail', ''));
begin
  if v_name is null then
    return private.signup_rejection(input_message => 'Please enter your name.');
  end if;
  if length(v_name) > 100 then
    return private.signup_rejection(input_message => 'Your name can be at most 100 characters.');
  end if;
  if v_level <> '' and v_level !~ '^[0-9]+(\.[0-9]+)?$' then
    return private.signup_rejection(input_message => 'Enter your Playtomic level as a number, like 2.5.');
  end if;
  if v_source is not null and v_source not in ('lobster', 'instagram', 'plaza_whatsapp', 'other') then
    return private.signup_rejection(input_message => 'Please pick how you found us from the list.');
  end if;
  -- A detail sent with instagram/plaza_whatsapp is dropped by the trigger, not rejected.
  if v_source in ('lobster', 'other') and length(v_detail) > 100 then
    return private.signup_rejection(input_message => 'How you found us can be at most 100 characters.');
  end if;
  if exists (
    select 1 from public.players p
     where p.status = 'placeholder'
       and lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = lower(v_name)
  ) then
    return private.signup_rejection(
      input_message => 'You’ve already been added to a Lobster team — ask an admin to invite you.');
  end if;
  return '{}'::jsonb;
end;
$function$;

revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

-- ── 3. Confirmed-user trigger: store the answer (DESIGN §3.2) ───────────────
create or replace function private.create_player_for_confirmed_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name    text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_level   numeric := private.parse_metadata_level(v_meta ->> 'playtomic_level');
  v_source  text  := nullif(btrim(coalesce(v_meta ->> 'signup_source', '')), '');
  v_created uuid;
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
    on conflict (id) do nothing
    returning id into v_created;
  exception when unique_violation then
    return new;
  end;

  -- Only for a player created just now. Losing the answer is acceptable;
  -- failing the email confirmation is not, so any error is swallowed.
  if v_created is not null and v_source is not null then
    begin
      insert into public.player_signup_source(player_id, source, detail)
      values (
        v_created,
        v_source,
        case when v_source in ('lobster', 'other')
             then nullif(btrim(coalesce(v_meta ->> 'signup_source_detail', '')), '')
        end
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$function$;

revoke all on function private.create_player_for_confirmed_user() from public, anon, authenticated;
