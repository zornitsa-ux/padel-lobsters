-- Schema improvements — Phase 1: tournaments, registrations, and matches
-- Implements Tasks 1–5 from docs/issues/schema_improvements_phase_1.md

-- Task 1.1 / Task 1.2: make both transfer RPCs promote existing waitlist/cancelled rows
CREATE OR REPLACE FUNCTION public.respond_to_transfer(
  input_transfer_id uuid,
  input_accept boolean
)
RETURNS TABLE (status text)
LANGUAGE plpgsql
SECURITY DEFINER
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
  UPDATE public.registrations
     SET status = 'registered',
         payment_status = 'transferred',
         payment_method = 'transferred_from:' || v_xfer.from_player_id::text
   WHERE tournament_id = v_xfer.tournament_id
     AND player_id = v_xfer.to_player_id
     AND registrations.status IN ('waitlist', 'cancelled');
  IF NOT FOUND THEN
    INSERT INTO public.registrations (tournament_id, player_id, status, payment_status, payment_method)
    VALUES (
      v_xfer.tournament_id,
      v_xfer.to_player_id,
      'registered',
      'transferred',
      'transferred_from:' || v_xfer.from_player_id::text
    );
  END IF;
  UPDATE public.registration_transfers SET status = 'accepted', responded_at = now() WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'accepted'::text;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_force_accept_transfer(
  input_transfer_id uuid
)
RETURNS TABLE(status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_xfer public.registration_transfers%rowtype;
  v_started boolean;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  SELECT * INTO v_xfer FROM public.registration_transfers WHERE id = input_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text; RETURN; END IF;
  IF v_xfer.status <> 'pending' THEN RETURN QUERY SELECT 'not_pending'::text; RETURN; END IF;
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
  UPDATE public.registrations
     SET status = 'registered',
         payment_status = 'transferred',
         payment_method = 'transferred_from:' || v_xfer.from_player_id::text
   WHERE tournament_id = v_xfer.tournament_id
     AND player_id = v_xfer.to_player_id
     AND registrations.status IN ('waitlist', 'cancelled');
  IF NOT FOUND THEN
    INSERT INTO public.registrations (tournament_id, player_id, status, payment_status, payment_method)
    VALUES (
      v_xfer.tournament_id,
      v_xfer.to_player_id,
      'registered',
      'transferred',
      'transferred_from:' || v_xfer.from_player_id::text
    );
  END IF;
  UPDATE public.registration_transfers
     SET status = 'accepted', responded_at = now(), closed_reason = 'admin_force_accept', closed_at = now()
   WHERE id = v_xfer.id;
  RETURN QUERY SELECT 'accepted'::text;
END
$$;

-- Task 2: enforce NOT NULL on FK columns
ALTER TABLE registrations ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE registrations ALTER COLUMN player_id SET NOT NULL;
ALTER TABLE matches ALTER COLUMN tournament_id SET NOT NULL;

-- Task 3: unique partial index
CREATE UNIQUE INDEX registrations_tournament_player_active_uniq
  ON registrations (tournament_id, player_id)
  WHERE status IN ('registered', 'waitlist');

-- Task 4: auxiliary indexes
CREATE INDEX registrations_tournament_id_idx ON registrations (tournament_id);
CREATE INDEX registrations_player_id_idx ON registrations (player_id);
CREATE INDEX matches_tournament_id_idx ON matches (tournament_id);

-- Task 5: CHECK constraints
ALTER TABLE registrations
  ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('registered', 'waitlist', 'cancelled'));

ALTER TABLE registrations
  ADD CONSTRAINT registrations_payment_status_check
  CHECK (payment_status IN ('unpaid', 'tikkied', 'pending_confirmation', 'paid', 'transferred'));

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('upcoming', 'active', 'completed'));
