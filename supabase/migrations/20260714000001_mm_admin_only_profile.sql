-- Matchmaking V2 — D-017: mm_* is admin-only, redacted from the self-profile.
--
-- get_my_profile_v2() returns SETOF players via SELECT *, which after M3.1
-- transmits a signed-in player their own mm_rating / mm_sigma /
-- mm_rating_updated_at. DESIGN §5 wants admin-only visibility for the learned
-- rating. Null those three columns in the returned row while keeping the
-- RETURNS SETOF players signature (row shape unchanged; no client type change).
-- The rowtype-variable redaction is robust to future players columns.
--
-- Admin visibility is preserved elsewhere: get_all_players_with_pii_v2()
-- (require_admin-gated) still returns the real values, and players_public omits
-- mm_* via its explicit column list.

CREATE OR REPLACE FUNCTION public.get_my_profile_v2()
RETURNS SETOF public.players
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_player_id uuid;
  v_row       public.players%rowtype;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  FOR v_row IN SELECT * FROM public.players WHERE id = v_player_id LOOP
    v_row.mm_rating            := NULL;
    v_row.mm_sigma             := NULL;
    v_row.mm_rating_updated_at := NULL;
    RETURN NEXT v_row;
  END LOOP;
END
$function$;
