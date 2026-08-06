-- ============================================================================
-- Capacity decisions move from the client into the database.
--
-- Registering used to work like this: the client counted `status = 'registered'`
-- rows in its TanStack Query cache, compared that to max_players, and inserted
-- the row with whichever status it had decided on. Three ways that goes wrong —
-- a cold cache counts 0 and everyone is 'registered'; a backgrounded tab counts
-- a stale number; two tabs never see each other. 20260806211143 stops the
-- resulting row from being written, but a hard error is a poor substitute for
-- putting the player on the waitlist, which is what should have happened.
--
-- These RPCs make the decision under the tournament row lock, so the answer is
-- correct by construction rather than caught after the fact.
--
-- Lock order: take the tournaments row FOR UPDATE first, before touching any
-- registration. The capacity trigger takes the same lock, which is a no-op
-- here (same transaction) and keeps other routes serialised.
--
-- Each function sets app.audit_source so registration_status_events records
-- *why* a row changed, not just that it did. A promotion tagged
-- 'cancel_registration' is the automatic one that follows someone leaving; the
-- same transition tagged 'promote_waitlist_registration' is an admin pressing
-- Confirm. That distinction is what the LOBS #10 investigation lacked.
-- ============================================================================

-- ── register_for_tournament ─────────────────────────────────────────────────
-- Replaces the client-side count + insert. Players register themselves;
-- registering someone else is an admin action.
create or replace function public.register_for_tournament(
  input_tournament_id uuid,
  input_player_id uuid
)
returns table(status text, registration_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_max integer;
  v_count integer;
  v_existing public.registrations%rowtype;
  v_status text;
  v_id uuid;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'register_for_tournament', true);

  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if input_player_id is distinct from auth.uid() then
    perform public.require_admin();
  end if;

  select t.max_players into v_max
    from public.tournaments t where t.id = input_tournament_id
   for update;
  if not found then
    return query select 'not_found'::text, null::uuid; return;
  end if;

  -- An active row already exists: report it rather than tripping
  -- registrations_tournament_player_active_uniq. A double-tap lands here.
  select * into v_existing
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.player_id = input_player_id
     and r.status in ('registered', 'waitlist')
   limit 1;
  if found then
    return query select ('already_' || v_existing.status)::text, v_existing.id; return;
  end if;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.status = 'registered';

  v_status := case when v_count < v_max then 'registered' else 'waitlist' end;

  -- A new row rather than reviving a cancelled one: the cancellation stays in
  -- the record, and registration_status_events shows both.
  insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  values (input_tournament_id, input_player_id, v_status, 'unpaid', '')
  returning id into v_id;

  return query select v_status, v_id;
end
$function$;

-- ── cancel_registration ─────────────────────────────────────────────────────
-- The fix for the LOBS #10 defect. The old client-side version promoted the
-- oldest waitlister after *every* cancellation. A cancellation is a
-- cancellation whether the player was registered or waitlisted — but only one
-- of those frees a spot. Someone leaving the waitlist was never occupying
-- anything, so promoting in that case adds a player the event has no room for.
-- That happened twice on LOBS #10 and took it from 24 to 26.
create or replace function public.cancel_registration(input_registration_id uuid)
returns table(status text, promoted_registration_id uuid, promoted_player_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_tournament_id uuid;
  v_reg public.registrations%rowtype;
  v_max integer;
  v_count integer;
  v_freed_a_spot boolean;
  v_promoted public.registrations%rowtype;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'cancel_registration', true);
  perform public.require_admin();

  -- First read is only for the tournament id, so the locks can be taken in the
  -- house order: tournament, then registration. The status is deliberately read
  -- again below rather than trusted from here — two concurrent cancels of the
  -- same row would otherwise both see 'registered', both set v_freed_a_spot,
  -- and promote two waitlisters into one freed spot.
  select r.tournament_id into v_tournament_id
    from public.registrations r where r.id = input_registration_id;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid; return;
  end if;

  select t.max_players into v_max
    from public.tournaments t where t.id = v_tournament_id
   for update;

  select * into v_reg from public.registrations r
   where r.id = input_registration_id
   for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid; return;
  end if;
  if v_reg.status = 'cancelled' then
    return query select 'already_cancelled'::text, null::uuid, null::uuid; return;
  end if;

  v_freed_a_spot := v_reg.status = 'registered';

  update public.registrations r set status = 'cancelled' where r.id = v_reg.id;

  if not v_freed_a_spot then
    return query select 'cancelled'::text, null::uuid, null::uuid; return;
  end if;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'registered';

  -- Only promote into an actual opening. On an event that is still over
  -- capacity — LOBS #10 is, at 26/24 — this promotes nobody, so the event
  -- converges back to its cap as people drop out instead of holding at 26.
  if v_count >= v_max then
    return query select 'cancelled'::text, null::uuid, null::uuid; return;
  end if;

  select * into v_promoted
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'waitlist'
   order by r.created_at, r.id
   limit 1;
  if not found then
    return query select 'cancelled'::text, null::uuid, null::uuid; return;
  end if;

  update public.registrations r set status = 'registered' where r.id = v_promoted.id;

  return query select 'cancelled'::text, v_promoted.id, v_promoted.player_id;
end
$function$;

-- ── promote_waitlist_registration ───────────────────────────────────────────
-- The waitlist "Confirm" button, which previously wrote status = 'registered'
-- straight to the table with no capacity check of any kind. Returns
-- 'tournament_full' as a value rather than raising, so the UI can show a toast.
create or replace function public.promote_waitlist_registration(input_registration_id uuid)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_reg public.registrations%rowtype;
  v_max integer;
  v_count integer;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'promote_waitlist_registration', true);
  perform public.require_admin();

  select * into v_reg from public.registrations r where r.id = input_registration_id;
  if not found then
    return query select 'not_found'::text; return;
  end if;
  if v_reg.status = 'registered' then
    return query select 'already_registered'::text; return;
  end if;
  if v_reg.status <> 'waitlist' then
    return query select 'not_waitlisted'::text; return;
  end if;

  select t.max_players into v_max
    from public.tournaments t where t.id = v_reg.tournament_id
   for update;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'registered';

  if v_count >= v_max then
    return query select 'tournament_full'::text; return;
  end if;

  update public.registrations r set status = 'registered' where r.id = v_reg.id;
  return query select 'promoted'::text;
end
$function$;

-- ── apply_registration_transfer ─────────────────────────────────────────────
-- The swap half of accepting a transfer, extracted because respond_to_transfer
-- and admin_force_accept_transfer carried it as two verbatim copies — including
-- the same bug.
--
-- The bug: the from-side UPDATE is guarded `AND status = 'registered'`, so if
-- that player had already cancelled it matched nothing and silently did
-- nothing. The `IF NOT FOUND` that follows refers to the *second* UPDATE, so
-- nothing noticed, and the recipient was registered anyway — a transfer that
-- adds a player without removing one. Now the from-side row count is checked
-- and the caller gets 'from_not_registered'.
create or replace function public.apply_registration_transfer(input_transfer_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_xfer public.registration_transfers%rowtype;
  v_rows integer;
begin
  select * into v_xfer from public.registration_transfers where id = input_transfer_id;
  if not found then
    return 'not_found';
  end if;

  perform 1 from public.tournaments t where t.id = v_xfer.tournament_id for update;

  update public.registrations r
     set status = 'cancelled',
         payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   where r.tournament_id = v_xfer.tournament_id
     and r.player_id = v_xfer.from_player_id
     and r.status = 'registered';
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return 'from_not_registered';
  end if;

  update public.registrations r
     set status = 'registered',
         payment_status = 'transferred',
         payment_method = 'transferred_from:' || v_xfer.from_player_id::text
   where r.tournament_id = v_xfer.tournament_id
     and r.player_id = v_xfer.to_player_id
     and r.status in ('waitlist', 'cancelled');
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
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

-- ── The two transfer entry points, now sharing the swap ─────────────────────
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
    return query select v_result; return;
  end if;

  update public.registration_transfers
     set status = 'accepted', responded_at = now(), closed_reason = 'admin_force_accept', closed_at = now()
   where id = v_xfer.id;
  return query select 'accepted'::text;
end
$function$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Deny-all baseline from 20260727194010: revoke the implicit PUBLIC grant, then
-- hand back only what the app needs. apply_registration_transfer is internal —
-- callers go through the two transfer entry points.
revoke execute on function public.register_for_tournament(uuid, uuid) from public, anon;
revoke execute on function public.cancel_registration(uuid) from public, anon;
revoke execute on function public.promote_waitlist_registration(uuid) from public, anon;
revoke execute on function public.apply_registration_transfer(uuid) from public, anon, authenticated;

grant execute on function public.register_for_tournament(uuid, uuid) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.promote_waitlist_registration(uuid) to authenticated;
grant execute on function public.apply_registration_transfer(uuid) to service_role;
