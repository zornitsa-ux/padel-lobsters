-- Make profile updates distinguish "field not touched" from "field cleared".
--
-- update_my_profile / admin_update_player used:
--     <field> = coalesce(input_payload->>'<field>', p.<field>)
-- coalesce only falls back on NULL, but the form submits an empty string ('')
-- for an empty field. '' is not NULL, so coalesce kept it and overwrote the
-- stored value. For email this also broke login: verify-pin fed the empty
-- string to GoTrue's generate_link ("An email address is required" -> 500).
--
-- Fix: key off whether the field is PRESENT in the payload (JSONB ? operator)
-- instead of off NULL-ness of its value:
--     key absent           -> leave the column unchanged (user didn't touch it)
--     key present, value    -> set it
--     key present, '' / ws  -> clear it (store NULL)
-- The client (src/api/players.js) already sends a sparse payload — a key is
-- only included when the caller passed that field — so key-presence is a
-- faithful "did the user touch this?" signal. Typed fields
-- (numeric/boolean/date) already guard blanks via cast/nullif and are
-- unchanged. (verify-pin is separately hardened to key auth on a synthetic
-- address so login no longer depends on the email column at all.)

CREATE OR REPLACE FUNCTION public.update_my_profile(input_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  v_player_id uuid;
  v_updated boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  v_player_id := auth.uid();
  IF v_player_id IS NULL OR input_payload IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  PERFORM public.require_trusted_device();
  WITH upd AS (
    UPDATE public.players p SET
      name                  = CASE WHEN input_payload ? 'name'               THEN nullif(btrim(input_payload->>'name'), '')               ELSE p.name END,
      email                 = CASE WHEN input_payload ? 'email'              THEN nullif(btrim(input_payload->>'email'), '')              ELSE p.email END,
      phone                 = CASE WHEN input_payload ? 'phone'              THEN nullif(btrim(input_payload->>'phone'), '')              ELSE p.phone END,
      birthday              = CASE WHEN input_payload ? 'birthday'           THEN nullif(input_payload->>'birthday', '')::date            ELSE p.birthday END,
      country               = CASE WHEN input_payload ? 'country'            THEN nullif(btrim(input_payload->>'country'), '')            ELSE p.country END,
      gender                = CASE WHEN input_payload ? 'gender'             THEN nullif(btrim(input_payload->>'gender'), '')             ELSE p.gender END,
      is_left_handed        = coalesce((input_payload->>'is_left_handed')::boolean,             p.is_left_handed),
      preferred_position    = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
      playtomic_level       = coalesce((input_payload->>'playtomic_level')::numeric,            p.playtomic_level),
      adjusted_level        = coalesce((input_payload->>'playtomic_level')::numeric,            p.playtomic_level) + p.adjustment,
      playtomic_username    = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
      tagline               = CASE WHEN input_payload ? 'tagline'            THEN nullif(btrim(input_payload->>'tagline'), '')            ELSE p.tagline END,
      tagline_label         = CASE WHEN input_payload ? 'tagline_label'      THEN nullif(btrim(input_payload->>'tagline_label'), '')      ELSE p.tagline_label END,
      avatar_url            = CASE WHEN input_payload ? 'avatar_url'         THEN nullif(btrim(input_payload->>'avatar_url'), '')         ELSE p.avatar_url END,
      playtomic_updated_at  = CASE WHEN (input_payload ? 'playtomic_level')
                                   THEN now()
                                   ELSE p.playtomic_updated_at END
    WHERE p.id = v_player_id
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM upd) INTO v_updated;
  RETURN v_updated;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_player(input_target_id uuid, input_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE v_updated boolean := false;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_target_id IS NULL OR input_payload IS NULL THEN RETURN false; END IF;
  WITH upd AS (
    UPDATE public.players p SET
      name = CASE WHEN input_payload ? 'name' THEN nullif(btrim(input_payload->>'name'), '') ELSE p.name END,
      email = CASE WHEN input_payload ? 'email' THEN nullif(btrim(input_payload->>'email'), '') ELSE p.email END,
      phone = CASE WHEN input_payload ? 'phone' THEN nullif(btrim(input_payload->>'phone'), '') ELSE p.phone END,
      notes = CASE WHEN input_payload ? 'notes' THEN nullif(btrim(input_payload->>'notes'), '') ELSE p.notes END,
      playtomic_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjustment = coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      adjusted_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level)
                      + coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      playtomic_username = CASE WHEN input_payload ? 'playtomic_username' THEN nullif(btrim(input_payload->>'playtomic_username'), '') ELSE p.playtomic_username END,
      gender = CASE WHEN input_payload ? 'gender' THEN nullif(btrim(input_payload->>'gender'), '') ELSE p.gender END,
      status = CASE WHEN input_payload ? 'status' THEN nullif(btrim(input_payload->>'status'), '') ELSE p.status END,
      is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      country = CASE WHEN input_payload ? 'country' THEN nullif(btrim(input_payload->>'country'), '') ELSE p.country END,
      avatar_url = CASE WHEN input_payload ? 'avatar_url' THEN nullif(btrim(input_payload->>'avatar_url'), '') ELSE p.avatar_url END,
      birthday = CASE WHEN input_payload ? 'birthday' THEN nullif(input_payload->>'birthday', '')::date ELSE p.birthday END,
      preferred_position = CASE WHEN input_payload ? 'preferred_position' THEN nullif(btrim(input_payload->>'preferred_position'), '') ELSE p.preferred_position END,
      tagline = CASE WHEN input_payload ? 'tagline' THEN nullif(btrim(input_payload->>'tagline'), '') ELSE p.tagline END,
      tagline_label = CASE WHEN input_payload ? 'tagline_label' THEN nullif(btrim(input_payload->>'tagline_label'), '') ELSE p.tagline_label END,
      playtomic_updated_at = CASE WHEN (input_payload ? 'playtomic_level') THEN now() ELSE p.playtomic_updated_at END
    WHERE p.id = input_target_id RETURNING 1
  ) SELECT EXISTS(SELECT 1 FROM upd) INTO v_updated;
  IF v_updated THEN
    INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
    VALUES (input_target_id, 'admin_action', true);
  END IF;
  RETURN v_updated;
END $function$;
