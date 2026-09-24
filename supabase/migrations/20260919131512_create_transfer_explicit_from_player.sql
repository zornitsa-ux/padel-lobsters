-- ============================================================================
-- create_transfer previously always took the FROM player from auth.uid(),
-- which is correct for a player transferring their own spot but wrong for an
-- admin starting a transfer on behalf of someone else's registration (the
-- "Transfer spot to another player" button in the admin registered-players
-- list): it silently tried to transfer the ADMIN's own spot instead of the
-- row they clicked.
--
-- input_from_player_id is now an explicit, optional argument. Omitted (the
-- default), behaviour is unchanged — the caller transfers their own spot.
-- When it names a different player, the caller must be an admin (checked
-- server-side via require_admin(), not trusted from the client) — that's
-- exactly the "admin acting on someone else's registration" case.
--
-- The old create_transfer(uuid, uuid) is dropped rather than left alongside
-- this one: CREATE OR REPLACE only replaces an exact signature match, so a
-- differently-shaped function creates a second overload instead. Leaving
-- both would let PostgREST see two matching candidates for an ordinary
-- 2-argument self-service call (ambiguous-function resolution risk), and a
-- freshly created function grants EXECUTE to PUBLIC by default, which would
-- have quietly made this one callable by `anon` unlike the rest of this
-- schema's functions.
-- ============================================================================

drop function if exists public.create_transfer(uuid, uuid);

create or replace function public.create_transfer(
  input_to_player_id uuid,
  input_tournament_id uuid,
  input_from_player_id uuid default null
)
 returns table(transfer_id uuid, status text)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_caller_id uuid;
  v_from_player_id uuid;
  v_target_status text;
  v_existing_pending uuid;
  v_started boolean;
  v_new_id uuid;
begin
  set local statement_timeout = '30s';
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_from_player_id := coalesce(input_from_player_id, v_caller_id);

  -- Acting on someone else's registration requires admin. This is the
  -- server-side gate; the client is never trusted to decide it may transfer
  -- another player's spot just because it asked to.
  if v_from_player_id is distinct from v_caller_id then
    perform public.require_admin();
  end if;

  if input_to_player_id is null or input_to_player_id = v_from_player_id then
    return query select null::uuid, 'invalid_target'::text; return;
  end if;
  if not exists (
    select 1 from public.players p
     where p.id = input_to_player_id and coalesce(p.status, 'active') = 'active'
  ) then
    return query select null::uuid, 'invalid_target'::text; return;
  end if;
  if not exists (
    select 1 from public.registrations r
     where r.tournament_id = input_tournament_id
       and r.player_id = v_from_player_id
       and r.status = 'registered'
  ) then
    return query select null::uuid, 'not_registered'::text; return;
  end if;
  select r.status into v_target_status
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.player_id = input_to_player_id
     and r.status = 'registered'
   limit 1;
  if v_target_status = 'registered' then
    return query select null::uuid, 'target_already_registered'::text; return;
  end if;
  v_started := public.tournament_start_ts(input_tournament_id) <= now();
  if coalesce(v_started, true) then
    return query select null::uuid, 'tournament_started'::text; return;
  end if;
  select rt.id into v_existing_pending
    from public.registration_transfers rt
   where rt.tournament_id = input_tournament_id
     and rt.from_player_id = v_from_player_id
     and rt.status = 'pending'
   limit 1;
  if v_existing_pending is not null then
    return query select v_existing_pending, 'already_pending'::text; return;
  end if;
  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (input_tournament_id, v_from_player_id, input_to_player_id)
  returning id into v_new_id;
  return query select v_new_id, 'ok'::text;
end
$function$;

comment on function public.create_transfer(uuid, uuid, uuid) is
  'Creates a pending registration transfer. input_from_player_id defaults to auth.uid() (self-service); naming a different player requires the caller to be admin, checked server-side.';

-- Match the old function's grants exactly (authenticated only — anon is
-- excluded across this schema's write RPCs).
revoke execute on function public.create_transfer(uuid, uuid, uuid) from public;
revoke execute on function public.create_transfer(uuid, uuid, uuid) from anon;
grant execute on function public.create_transfer(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_transfer(uuid, uuid, uuid) to service_role;
