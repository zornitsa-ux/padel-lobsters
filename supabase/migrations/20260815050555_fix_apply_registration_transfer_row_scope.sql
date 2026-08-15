-- Fix: apply_registration_transfer aborts with 23505 (duplicate key value
-- violates unique constraint "registrations_tournament_player_active_uniq")
-- when the recipient already has more than one non-active registration row
-- for the tournament.
--
-- The predicate below predates the Aug 6 capacity-guard refactor (it was
-- carried verbatim from the two copies in respond_to_transfer /
-- admin_force_accept_transfer this function replaced) — the refactor did not
-- introduce it. What made it reachable is 20260806211102
-- (registrations_no_hard_deletes): cancelled rows are never deleted anymore,
-- so a recipient who has cancelled more than once, or transferred more than
-- once, on the same event accumulates multiple 'cancelled' rows. The old
-- UPDATE matched every row for (tournament_id, player_id) with status in
-- ('waitlist', 'cancelled') and had no row-id scoping, so it flipped ALL of
-- them to 'registered' in one statement — producing two or more 'registered'
-- rows for the same pair and tripping the unique index. Confirmed against
-- production data: recipients with a registered row plus two stale cancelled
-- rows, and recipients with one cancelled row plus one waitlist row.
--
-- Fix: resolve the recipient's single ACTIVE row first (registered or
-- waitlist — the unique index already guarantees at most one exists) and
-- branch on it, instead of inferring behaviour from an UPDATE's row count:
--   * already 'registered'  -> return 'to_already_registered' before any
--     write. This also closes a TOCTOU gap: the recipient can register
--     between the transfer offer being created and being accepted.
--   * 'waitlist'            -> UPDATE that row by id to 'registered'.
--   * no active row         -> INSERT a fresh row. Stale 'cancelled' rows are
--     left untouched — never revived. This matches register_for_tournament's
--     existing stance ("A new row rather than reviving a cancelled one: the
--     cancellation stays in the record, and registration_status_events shows
--     both") and preserves payment_method history on the old rows, which
--     D-6's audit trail depends on.
--
-- The from-side UPDATE is also resolved to a row id first, for symmetry and
-- so it can be locked FOR UPDATE; it was not itself multi-row vulnerable
-- (the same unique index bounds 'registered' rows to at most one per pair).
create or replace function public.apply_registration_transfer(input_transfer_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_xfer public.registration_transfers%rowtype;
  v_from_reg_id uuid;
  v_to_reg_id uuid;
  v_to_status text;
begin
  select * into v_xfer from public.registration_transfers where id = input_transfer_id;
  if not found then
    return 'not_found';
  end if;

  perform 1 from public.tournaments t where t.id = v_xfer.tournament_id for update;

  select r.id into v_from_reg_id
    from public.registrations r
   where r.tournament_id = v_xfer.tournament_id
     and r.player_id = v_xfer.from_player_id
     and r.status = 'registered'
   for update;

  if v_from_reg_id is null then
    return 'from_not_registered';
  end if;

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
           payment_status = 'transferred',
           payment_method = 'transferred_from:' || v_xfer.from_player_id::text
     where r.id = v_to_reg_id;
  else
    insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method)
    values (
      v_xfer.tournament_id,
      v_xfer.to_player_id,
      'registered',
      'transferred',
      'transferred_from:' || v_xfer.from_player_id::text
    );
  end if;

  return 'accepted';
end
$function$;

-- Both refusals above are terminal: the recipient already holds the spot, or
-- the sender no longer holds one. Neither can turn back into an acceptable
-- offer, so the two entry points close the row the same way they already close
-- an offer that outlived its tournament — otherwise it stays 'pending', the
-- accept banner keeps rendering on the recipient's dashboard, and every tap
-- re-fails with no path to clear it.
create or replace function public.respond_to_transfer(input_transfer_id uuid, input_accept boolean)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_to_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
  v_started boolean;
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
    return query select 'declined'::text; return;
  end if;

  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  if coalesce(v_started, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     where id = v_xfer.id;
    return query select 'tournament_started'::text; return;
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
  v_started boolean;
  v_result text;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'admin_force_accept_transfer', true);
  perform public.require_admin();
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;

  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  if coalesce(v_started, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     where id = v_xfer.id;
    return query select 'tournament_started'::text; return;
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
