-- Two fixes to the spot-transfer flow, prompted by a production incident:
-- a player transferred her spot ~2.5h after that round's matches were
-- scheduled, so her id stayed baked into matches.team1_ids/team2_ids while
-- her registration flipped to 'cancelled'. Finishing the tournament then
-- threw "player ... not in ratings", because the rating engine only trusts
-- 'registered' rows and had no idea a different player had actually played.
--
-- 1. apply_registration_transfer now also swaps the player's id in any
--    matches row for that tournament, so a transfer can never leave the
--    schedule pointing at a player who no longer holds the spot.
-- 2. Transfers close 12h before tournament start (tournament_started was
--    the only prior gate, which allowed a transfer minutes before courts
--    are assigned — exactly when schedule drift is most likely).
-- 3. Admins keep a one-tap, cutoff-bypassing override
--    (admin_transfer_registration) for emergencies where the outgoing
--    player is unreachable and waiting on an accept isn't an option.
--
-- Layered on top of 20260919123328/20260919131512/20260922084647 (admin
-- on-behalf transfers, payment_status carry-over, decline-drops-waitlist) —
-- every function this migration replaces keeps that behavior; this only
-- adds the matches sync and swaps the tournament_started gate for the 12h
-- cutoff.

-- ── 1. Sync matches on transfer accept ──────────────────────────────────
create or replace function public.apply_registration_transfer(input_transfer_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_xfer public.registration_transfers%rowtype;
  v_from_reg_id uuid;
  v_from_payment_status text;
  v_new_payment_status text;
  v_to_reg_id uuid;
  v_to_status text;
begin
  select * into v_xfer from public.registration_transfers where id = input_transfer_id;
  if not found then
    return 'not_found';
  end if;

  perform 1 from public.tournaments t where t.id = v_xfer.tournament_id for update;

  select r.id, r.payment_status into v_from_reg_id, v_from_payment_status
    from public.registrations r
   where r.tournament_id = v_xfer.tournament_id
     and r.player_id = v_xfer.from_player_id
     and r.status = 'registered'
   for update;

  if v_from_reg_id is null then
    return 'from_not_registered';
  end if;

  v_new_payment_status := case when v_from_payment_status = 'paid' then 'paid' else 'unpaid' end;

  select r.id, r.status into v_to_reg_id, v_to_status
    from public.registrations r
   where r.tournament_id = v_xfer.tournament_id
     and r.player_id = v_xfer.to_player_id
     and r.status in ('registered', 'waitlist')
   for update;

  if v_to_status = 'registered' then
    return 'to_already_registered';
  end if;

  update public.registrations r
     set status = 'cancelled',
         payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   where r.id = v_from_reg_id;

  if v_to_reg_id is not null then
    update public.registrations r
       set status = 'registered',
           payment_status = v_new_payment_status,
           payment_method = 'transferred_from:' || v_xfer.from_player_id::text
     where r.id = v_to_reg_id;
  else
    insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method)
    values (
      v_xfer.tournament_id,
      v_xfer.to_player_id,
      'registered',
      v_new_payment_status,
      'transferred_from:' || v_xfer.from_player_id::text
    );
  end if;

  -- Schedule state is separate from registration state: a match generated
  -- before this transfer was accepted still points at from_player_id. Keep
  -- it truthful, or Finish Tournament's rating fold-in breaks on a player id
  -- that no longer has a 'registered' row. array_replace is a no-op on rows
  -- where the id isn't present.
  update public.matches m
     set team1_ids = array_replace(m.team1_ids, v_xfer.from_player_id, v_xfer.to_player_id),
         team2_ids = array_replace(m.team2_ids, v_xfer.from_player_id, v_xfer.to_player_id)
   where m.tournament_id = v_xfer.tournament_id
     and (v_xfer.from_player_id = any(m.team1_ids) or v_xfer.from_player_id = any(m.team2_ids));

  return 'accepted';
end
$function$;

comment on function public.apply_registration_transfer(uuid) is
  'Applies an accepted/force-accepted registration transfer: cancels the giving player''s registration, registers the recipient (carrying over payment_status), and syncs the transferred player''s id into any matches row already generated for this tournament.';

-- ── 2. 12h transfer cutoff ──────────────────────────────────────────────
-- Internal-only helper (same posture as tournament_start_ts): called from
-- inside other SECURITY DEFINER functions, never invoked directly by a
-- client role.
create or replace function public.tournament_transfers_closed(input_tournament_id uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
  select coalesce(public.tournament_start_ts(input_tournament_id) - interval '12 hours' <= now(), true)
$function$;

revoke execute on function public.tournament_transfers_closed(uuid) from public, anon, authenticated;
grant execute on function public.tournament_transfers_closed(uuid) to service_role;

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
  v_closed boolean;
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
  v_closed := public.tournament_transfers_closed(input_tournament_id);
  if coalesce(v_closed, true) then
    return query select null::uuid, 'transfers_closed'::text; return;
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

-- Same (uuid, uuid, uuid) signature as 20260919131512 established, so
-- CREATE OR REPLACE preserves that migration's grants (authenticated,
-- service_role) — nothing to reassert here.

create or replace function public.respond_to_transfer(input_transfer_id uuid, input_accept boolean)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_to_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
  v_closed boolean;
  v_result text;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'respond_to_transfer', true);
  v_to_player_id := auth.uid();
  if v_to_player_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.to_player_id <> v_to_player_id then return query select 'forbidden'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;

  if input_accept is not true then
    update public.registration_transfers set status = 'declined', responded_at = now() where id = v_xfer.id;

    -- Drop the recipient off the waitlist too, if that's where they were
    -- sitting — declining an offer means they're done waiting, not still
    -- in line for the next one.
    --
    -- Table alias + qualified columns are load-bearing here, not style: this
    -- function's RETURNS TABLE(status text) makes bare `status` ambiguous
    -- between the registrations column and the function's own output column
    -- (PL/pgSQL error 42702), which the unqualified form in the original
    -- migration (20260922084647) hits whenever this branch actually runs.
    update public.registrations r
       set status = 'cancelled'
     where r.tournament_id = v_xfer.tournament_id
       and r.player_id = v_to_player_id
       and r.status = 'waitlist';

    return query select 'declined'::text; return;
  end if;

  v_closed := public.tournament_transfers_closed(v_xfer.tournament_id);
  if coalesce(v_closed, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'transfers_closed', closed_at = now()
     where id = v_xfer.id;
    return query select 'transfers_closed'::text; return;
  end if;

  v_result := public.apply_registration_transfer(v_xfer.id);
  if v_result <> 'accepted' then
    if v_result in ('to_already_registered', 'from_not_registered') then
      update public.registration_transfers
         set status = 'auto_closed', closed_reason = v_result, closed_at = now()
       where id = v_xfer.id;
    end if;
    return query select v_result; return;
  end if;

  update public.registration_transfers set status = 'accepted', responded_at = now() where id = v_xfer.id;
  return query select 'accepted'::text;
end
$function$;

create or replace function public.admin_force_accept_transfer(input_transfer_id uuid)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_xfer public.registration_transfers%rowtype;
  v_closed boolean;
  v_result text;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'admin_force_accept_transfer', true);
  perform public.require_admin();
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;

  v_closed := public.tournament_transfers_closed(v_xfer.tournament_id);
  if coalesce(v_closed, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'transfers_closed', closed_at = now()
     where id = v_xfer.id;
    return query select 'transfers_closed'::text; return;
  end if;

  v_result := public.apply_registration_transfer(v_xfer.id);
  if v_result <> 'accepted' then
    if v_result in ('to_already_registered', 'from_not_registered') then
      update public.registration_transfers
         set status = 'auto_closed', closed_reason = v_result, closed_at = now()
       where id = v_xfer.id;
    end if;
    return query select v_result; return;
  end if;

  update public.registration_transfers
     set status = 'accepted', responded_at = now(), closed_reason = 'admin_force_accept', closed_at = now()
   where id = v_xfer.id;
  return query select 'accepted'::text;
end
$function$;

-- ── 3. Admin emergency override ─────────────────────────────────────────
-- Deliberately NOT gated by tournament_transfers_closed or
-- tournament_start_ts: an admin using this mid-event (e.g. a no-show
-- discovered at check-in) is legitimate, and the matches-sync above covers
-- an already-scheduled match automatically. The only hard stop is a
-- 'completed' tournament, since ratings may already be folded in
-- (tournaments.ratings_applied_at) — rewriting who played after that would
-- corrupt rating history for both players. Skips the pending/accept dance
-- entirely: the from-player may be unreachable, which is exactly when this
-- gets used, and it must work one-tap from an admin's phone.
create or replace function public.admin_transfer_registration(
  input_tournament_id uuid,
  input_from_player_id uuid,
  input_to_player_id uuid
)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_tournament_status text;
  v_new_id uuid;
  v_result text;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'admin_transfer_registration', true);
  perform public.require_admin();

  if input_from_player_id is null or input_to_player_id is null
     or input_from_player_id = input_to_player_id then
    return query select 'invalid_target'::text; return;
  end if;

  select t.status into v_tournament_status
    from public.tournaments t where t.id = input_tournament_id;
  if v_tournament_status = 'completed' then
    return query select 'tournament_completed'::text; return;
  end if;

  if not exists (
    select 1 from public.players p
     where p.id = input_to_player_id and coalesce(p.status, 'active') = 'active'
  ) then
    return query select 'invalid_target'::text; return;
  end if;

  if not exists (
    select 1 from public.registrations r
     where r.tournament_id = input_tournament_id
       and r.player_id = input_from_player_id
       and r.status = 'registered'
  ) then
    return query select 'not_registered'::text; return;
  end if;

  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id, status)
  values (input_tournament_id, input_from_player_id, input_to_player_id, 'pending')
  returning id into v_new_id;

  v_result := public.apply_registration_transfer(v_new_id);
  if v_result <> 'accepted' then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = v_result, closed_at = now()
     where id = v_new_id;
    return query select v_result; return;
  end if;

  update public.registration_transfers
     set status = 'accepted', responded_at = now(),
         closed_reason = 'admin_transfer', closed_at = now()
   where id = v_new_id;
  return query select 'accepted'::text;
end
$function$;

revoke execute on function public.admin_transfer_registration(uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_transfer_registration(uuid, uuid, uuid) to authenticated;
