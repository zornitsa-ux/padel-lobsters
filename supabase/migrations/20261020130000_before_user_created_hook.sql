-- Native signup validation (docs/pin-auth-removal C-2, C-3).
--
-- GoTrue calls this before it creates an auth user. It validates the signup
-- metadata with the rules self_signup_player applies (20261012120000) and
-- rejects with a 400 and a message the sign-up form shows as is. Email format
-- and uniqueness stay with GoTrue. Metadata is only validated here, never
-- trusted for authorization.

create or replace function public.before_user_created_hook(event jsonb)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_meta  jsonb := coalesce(event -> 'user' -> 'user_metadata', '{}'::jsonb);
  v_name  text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_level text  := replace(btrim(coalesce(v_meta ->> 'playtomic_level', '')), ',', '.');
begin
  if v_name is null then
    return private.signup_rejection(input_message => 'Please enter your name.');
  end if;
  if length(v_name) > 100 then
    return private.signup_rejection(input_message => 'Your name can be at most 100 characters.');
  end if;
  if v_level <> '' and v_level !~ '^\d+(\.\d+)?$' then
    return private.signup_rejection(input_message => 'Enter your Playtomic level as a number, like 2.5.');
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

create or replace function private.signup_rejection(input_message text)
 returns jsonb
 language sql
 immutable
 set search_path to 'pg_catalog'
as $function$
  select jsonb_build_object(
    'error', jsonb_build_object('http_code', 400, 'message', input_message))
$function$;

revoke all on function private.signup_rejection(text) from public, anon, authenticated;

grant usage on schema public to supabase_auth_admin;
revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;
