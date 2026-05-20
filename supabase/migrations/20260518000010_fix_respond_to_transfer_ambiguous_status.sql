-- Fix: ambiguous column reference "status" in respond_to_transfer (error 42702).
-- The function returns TABLE(status text), so PL/pgSQL treats "status" as both
-- an output variable and a table column in the WHERE clause at the registrations
-- UPDATE. Qualifying with the table name resolves the ambiguity.

CREATE OR REPLACE FUNCTION public.respond_to_transfer(
  input_transfer_id uuid,
  input_accept boolean
)
RETURNS TABLE (status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_to_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
  v_started boolean;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_to_player_id := auth.uid();
  IF v_to_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text; RETURN; END IF;
  IF v_xfer.to_player_id <> v_to_player_id THEN RETURN QUERY SELECT 'forbidden'::text; RETURN; END IF;
  IF v_xfer.status <> 'pending' THEN RETURN QUERY SELECT 'not_pending'::text; RETURN; END IF;
  IF input_accept IS NOT TRUE THEN
    UPDATE public.registration_transfers SET status = 'declined', responded_at = now() WHERE id = v_xfer.id;
    RETURN QUERY SELECT 'declined'::text; RETURN;
  END IF;
  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  IF coalesce(v_started, true) THEN
    UPDATE public.registration_transfers
       SET status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     WHERE id = v_xfer.id;
    RETURN QUERY SELECT 'tournament_started'::text; RETURN;
  END IF;
  UPDATE public.registrations
     SET status = 'cancelled',
         payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   WHERE tournament_id = v_xfer.tournament_id
     AND player_id = v_xfer.from_player_id
     AND registrations.status = 'registered';
  INSERT INTO public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  VALUES (
    v_xfer.tournament_id,
    v_xfer.to_player_id,
    'registered',
    'transferred',
    'transferred_from:' || v_xfer.from_player_id::text
  );
  UPDATE public.registration_transfers SET status = 'accepted', responded_at = now() WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'accepted'::text;
END
$function$;
