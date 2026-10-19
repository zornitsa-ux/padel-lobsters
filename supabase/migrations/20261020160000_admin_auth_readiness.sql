-- Admin sign-in readiness (docs/pin-auth-removal C-7): who has no real email,
-- who signed in with a PIN lately, and how many accounts hold a password.

create or replace function public.admin_auth_readiness()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.require_admin();

  return jsonb_build_object(
    'no_email', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name, p.id)
        from public.players p
        join auth.users u on u.id = p.id
       where coalesce(p.status, 'active') = 'active'
         and u.email like 'player-%@padelobsters.internal'
    ), '[]'::jsonb),
    'recent_pin_users', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', r.player_id, 'name', r.name, 'last_pin_at', r.last_pin_at)
               order by r.last_pin_at desc, r.player_id)
        from (
          select pa.player_id, p.name, max(pa.attempted_at) as last_pin_at
            from public.pin_attempts pa
            join public.players p on p.id = pa.player_id
           where pa.attempt_kind = 'player'
             and pa.succeeded
             and pa.attempted_at > now() - interval '14 days'
           group by pa.player_id, p.name
        ) r
    ), '[]'::jsonb),
    'password_count', (select count(*) from auth.users where coalesce(encrypted_password, '') <> '')
  );
end;
$function$;

revoke all on function public.admin_auth_readiness() from public, anon, authenticated;
grant execute on function public.admin_auth_readiness() to authenticated;
