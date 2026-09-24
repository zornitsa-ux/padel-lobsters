-- A waitlisted player who declines an offered transfer no longer wants to
-- wait for the next one either. Previously declining only closed out the
-- registration_transfers row and left their waitlist registration exactly
-- as it was, so they kept lingering on the waitlist (and could be offered
-- again) after explicitly saying no — confusing for admins reading the
-- waitlist and for the "who's actually still waiting" picture generally.
-- Now: declining also cancels their waitlist registration for that
-- tournament, if they hold one. Registered players aren't affected (this
-- only matches status = 'waitlist'), and this is a soft-delete (status ->
-- 'cancelled'), consistent with the no-hard-deletes policy on registrations
-- (20260806211102) — the audit trail is preserved via
-- registrations_log_status_change, attributed to the declining player
-- themselves (auth.uid()) with source 'respond_to_transfer'.
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

    -- Drop the recipient off the waitlist too, if that's where they were
    -- sitting — declining an offer means they're done waiting, not still
    -- in line for the next one.
    update public.registrations
       set status = 'cancelled'
     where tournament_id = v_xfer.tournament_id
       and player_id = v_to_player_id
       and status = 'waitlist';

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
