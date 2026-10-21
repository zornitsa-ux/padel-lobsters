-- Admin sign-in readiness (docs/pin-auth-removal C-7, redefined 2026-10-21):
-- who has no real email, who signed in with a PIN lately, and how many active
-- players have switched to email. Also: the access-token hook drops a stale
-- app_metadata role when the user has no players row (C-12).

create or replace function public.admin_auth_readiness()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.require_admin();

  return (
    with latest as (
      select p.id, p.name, u.last_sign_in_at,
             (select max(pa.attempted_at)
                from public.pin_attempts pa
               where pa.player_id = p.id
                 and pa.attempt_kind = 'player'
                 and pa.succeeded) as pin_at
        from public.players p
        join auth.users u on u.id = p.id
       where coalesce(p.status, 'active') = 'active'
         and u.last_sign_in_at is not null
    ),
    classified as (
      select id, name, pin_at,
             (pin_at is not null
              and pin_at <= last_sign_in_at
              and last_sign_in_at - pin_at <= interval '5 minutes') as by_pin
        from latest
    )
    select jsonb_build_object(
      'no_email', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name, p.id)
          from public.players p
          join auth.users u on u.id = p.id
         where coalesce(p.status, 'active') = 'active'
           and u.email like 'player-%@padelobsters.internal'
      ), '[]'::jsonb),
      'recent_pin_users', coalesce((
        select jsonb_agg(
                 jsonb_build_object('id', c.id, 'name', c.name, 'last_pin_at', c.pin_at)
                 order by c.pin_at desc, c.id)
          from classified c
         where c.by_pin and c.pin_at > now() - interval '14 days'
      ), '[]'::jsonb),
      'switched_count', (select count(*) from classified where not by_pin),
      'still_pin_count', (select count(*) from classified where by_pin)
    )
  );
end;
$function$;

revoke all on function public.admin_auth_readiness() from public, anon, authenticated;
grant execute on function public.admin_auth_readiness() to authenticated;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id  uuid;
  v_claims   jsonb;
  v_app_meta jsonb;
  v_role     text;
begin
  v_user_id  := (event->>'user_id')::uuid;
  v_claims   := event->'claims';
  -- Strip the retired device claims so pre-existing sessions stop carrying them
  -- forward on refresh.
  v_app_meta := coalesce(v_claims->'app_metadata', '{}'::jsonb) - 'device_trusted' - 'device_id';

  select role::text into v_role from public.players where id = v_user_id;
  if v_role is not null then
    v_app_meta := jsonb_set(v_app_meta, '{role}', to_jsonb(v_role));
  else
    v_app_meta := v_app_meta - 'role';
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_meta);
  return jsonb_build_object('claims', v_claims);
end;
$function$;
