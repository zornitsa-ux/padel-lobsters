-- ============================================================================
-- A registration transfer settles the recipient's payment_status from the
-- giving player's own payment_status, not a fixed 'transferred' placeholder.
-- Transfers happen directly between the two players, not through us: if the
-- giver had already paid, the recipient inherits 'paid' outright; otherwise
-- the recipient's row lands 'unpaid' and still owes payment (the WhatsApp
-- offer now carries the tournament's Tikkie link in that case — see
-- src/lib/whatsapp.ts).
--
-- payment_method still records 'transferred_from:<player_id>' either way, so
-- how the spot was acquired stays visible even once payment_status reads
-- 'paid' like any other confirmed registration.
-- ============================================================================

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

  return 'accepted';
end
$function$;

comment on function public.apply_registration_transfer(uuid) is
  'Applies an accepted/force-accepted registration transfer: cancels the giving player''s registration and registers the recipient, carrying over payment_status (paid stays paid; anything else lands unpaid, since the transfer happens directly between the two players).';
