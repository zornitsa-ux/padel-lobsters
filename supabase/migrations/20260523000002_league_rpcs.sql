-- League RPCs: final versions of all admin functions for league management.
-- Functions are ordered by call sequence (create league → teams → groups → bracket → results).

-- ── admin_create_league ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_league(
  input_payload jsonb
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_divisions text[];
  v_inserted  public.leagues%rowtype;
  v_description jsonb;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_payload IS NULL THEN
    RETURN NULL;
  END IF;
  IF btrim(coalesce(input_payload->>'name', '')) = '' THEN
    RAISE EXCEPTION 'league name is required';
  END IF;
  SELECT array_agg(trim(elem)::text) INTO v_divisions
    FROM jsonb_array_elements_text(
           CASE
             WHEN jsonb_typeof(input_payload->'divisions') = 'array'
               THEN input_payload->'divisions'
             ELSE '[]'::jsonb
           END
         ) AS elem
   WHERE length(trim(elem)) > 0;
  IF v_divisions IS NULL OR array_length(v_divisions, 1) = 0 THEN
    v_divisions := array['mens','womens'];
  END IF;
  v_description := CASE
    WHEN jsonb_typeof(input_payload->'description_sections') = 'array'
      THEN input_payload->'description_sections'
    ELSE '{}'::jsonb
  END;
  INSERT INTO public.leagues(
    name, description_md, status, divisions,
    group_stage_start, group_stage_end,
    finals_start, finals_end, created_by, description_sections)
  VALUES (
    btrim(input_payload->>'name'),
    coalesce(input_payload->>'description_md', ''),
    'draft',
    v_divisions,
    nullif(btrim(input_payload->>'group_stage_start'), '')::date,
    nullif(btrim(input_payload->>'group_stage_end'), '')::date,
    nullif(btrim(input_payload->>'finals_start'), '')::date,
    nullif(btrim(input_payload->>'finals_end'), '')::date,
    auth.uid(),
    COALESCE(v_description, '{}'::jsonb)
  ) RETURNING * INTO v_inserted;
  RETURN v_inserted;
END;
$$;

-- ── admin_update_league_status ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_update_league_status(
  input_league_id uuid,
  input_status    text
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league      public.leagues%rowtype;
  v_new_status  text   := lower(nullif(btrim(input_status), ''));
  v_order       text[] := array['draft','group_stage','knockout','completed'];
  v_current_pos int;
  v_new_pos     int;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_league_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'status is required';
  END IF;
  SELECT * INTO v_league FROM public.leagues WHERE id = input_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_current_pos := array_position(v_order, v_league.status);
  v_new_pos     := array_position(v_order, v_new_status);
  IF v_new_pos IS NULL THEN
    RAISE EXCEPTION 'invalid status: %', v_new_status;
  END IF;
  IF v_current_pos IS NOT NULL AND v_new_pos <= v_current_pos THEN
    RAISE EXCEPTION 'status must advance forward';
  END IF;
  UPDATE public.leagues SET status = v_new_status
   WHERE id = input_league_id
   RETURNING * INTO v_league;
  RETURN v_league;
END;
$$;

-- ── admin_create_league_team ──────────────────────────────────────────────────
-- Supports optional group_label so late-joining teams can be placed directly
-- without re-running admin_confirm_league_groups.

CREATE OR REPLACE FUNCTION public.admin_create_league_team(
  input_payload jsonb
)
RETURNS public.league_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league_id   uuid := nullif(btrim(input_payload->>'league_id'), '')::uuid;
  v_division    text := lower(nullif(btrim(input_payload->>'division'), ''));
  v_experience  text := lower(nullif(btrim(input_payload->>'experience_level'), 'intermediate'));
  v_player1     uuid;
  v_player2     uuid;
  v_placeholder text;
  v_team        public.league_teams%rowtype;
  v_preferred   text := nullif(btrim(input_payload->>'preferred_play_times'), '');
  v_group_label text := upper(nullif(btrim(input_payload->>'group_label'), ''));
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'league_id is required';
  END IF;
  IF v_division NOT IN ('mens','womens') THEN
    RAISE EXCEPTION 'division must be mens or womens';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = v_league_id) THEN
    RAISE EXCEPTION 'league not found';
  END IF;
  IF v_group_label IS NOT NULL AND v_group_label NOT IN ('A','B') THEN
    RAISE EXCEPTION 'group_label must be A or B';
  END IF;

  -- Resolve player 1 (real player or new placeholder)
  v_player1 := CASE
    WHEN input_payload ? 'player1_id'
      AND nullif(btrim(input_payload->>'player1_id'), '') IS NOT NULL
      THEN nullif(btrim(input_payload->>'player1_id'), '')::uuid
    ELSE NULL
  END;
  IF v_player1 IS NULL THEN
    v_placeholder := nullif(btrim(input_payload->>'player1_name'), '');
    IF v_placeholder IS NULL THEN
      RAISE EXCEPTION 'player1 is required';
    END IF;
    INSERT INTO public.players(name, status) VALUES (v_placeholder, 'placeholder')
      RETURNING id INTO v_player1;
  END IF;

  -- Resolve player 2
  v_player2 := CASE
    WHEN input_payload ? 'player2_id'
      AND nullif(btrim(input_payload->>'player2_id'), '') IS NOT NULL
      THEN nullif(btrim(input_payload->>'player2_id'), '')::uuid
    ELSE NULL
  END;
  IF v_player2 IS NULL THEN
    v_placeholder := nullif(btrim(input_payload->>'player2_name'), '');
    IF v_placeholder IS NULL THEN
      RAISE EXCEPTION 'player2 is required';
    END IF;
    INSERT INTO public.players(name, status) VALUES (v_placeholder, 'placeholder')
      RETURNING id INTO v_player2;
  END IF;

  IF v_player1 = v_player2 THEN
    RAISE EXCEPTION 'players must be different';
  END IF;

  v_experience := CASE
    WHEN v_experience IN ('beginner','intermediate','advanced') THEN v_experience
    ELSE 'intermediate'
  END;

  IF EXISTS (
    SELECT 1 FROM public.league_teams lt
     WHERE lt.league_id = v_league_id
       AND lt.division  = v_division
       AND (
         lt.player1_id = v_player1 OR lt.player2_id = v_player1
      OR lt.player1_id = v_player2 OR lt.player2_id = v_player2
       )
  ) THEN
    RAISE EXCEPTION 'one of the players is already assigned to this division';
  END IF;

  INSERT INTO public.league_teams (
    league_id, division, player1_id, player2_id,
    team_name, team_song, spirit_animal,
    experience_level, preferred_play_times, group_label
  ) VALUES (
    v_league_id, v_division, v_player1, v_player2,
    nullif(btrim(input_payload->>'team_name'), ''),
    nullif(btrim(input_payload->>'team_song'), ''),
    nullif(btrim(input_payload->>'spirit_animal'), ''),
    v_experience,
    v_preferred,
    v_group_label
  ) RETURNING * INTO v_team;

  RETURN v_team;
END;
$$;

-- ── admin_update_league_team ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_update_league_team(
  input_team_id uuid,
  input_payload jsonb
)
RETURNS public.league_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_team          public.league_teams%rowtype;
  v_player1       uuid;
  v_player2       uuid;
  v_placeholder   text;
  v_experience    text;
  v_team_name     text;
  v_team_song     text;
  v_spirit_animal text;
  v_preferred     text;
  v_group_label   text;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();

  SELECT * INTO v_team FROM public.league_teams WHERE id = input_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Player 1
  v_player1 := v_team.player1_id;
  IF input_payload ? 'player1_id'
     AND nullif(btrim(input_payload->>'player1_id'), '') IS NOT NULL
  THEN
    v_player1 := nullif(btrim(input_payload->>'player1_id'), '')::uuid;
  END IF;
  IF input_payload ? 'player1_name' AND v_player1 IS NULL THEN
    v_placeholder := nullif(btrim(input_payload->>'player1_name'), '');
    IF v_placeholder IS NOT NULL THEN
      INSERT INTO public.players(name, status) VALUES (v_placeholder, 'placeholder')
        RETURNING id INTO v_player1;
    END IF;
  END IF;

  -- Player 2
  v_player2 := v_team.player2_id;
  IF input_payload ? 'player2_id'
     AND nullif(btrim(input_payload->>'player2_id'), '') IS NOT NULL
  THEN
    v_player2 := nullif(btrim(input_payload->>'player2_id'), '')::uuid;
  END IF;
  IF input_payload ? 'player2_name' AND v_player2 IS NULL THEN
    v_placeholder := nullif(btrim(input_payload->>'player2_name'), '');
    IF v_placeholder IS NOT NULL THEN
      INSERT INTO public.players(name, status) VALUES (v_placeholder, 'placeholder')
        RETURNING id INTO v_player2;
    END IF;
  END IF;

  IF v_player1 = v_player2 THEN
    RAISE EXCEPTION 'players must be different';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_teams lt
     WHERE lt.league_id = v_team.league_id
       AND lt.division  = v_team.division
       AND lt.id        <> v_team.id
       AND (
         lt.player1_id = v_player1 OR lt.player2_id = v_player1
      OR lt.player1_id = v_player2 OR lt.player2_id = v_player2
       )
  ) THEN
    RAISE EXCEPTION 'one of the players is already assigned to this division';
  END IF;

  -- Scalar fields: use payload value when key is present, else keep existing
  v_team_name     := CASE WHEN input_payload ? 'team_name'
                           THEN nullif(btrim(input_payload->>'team_name'), '')
                           ELSE v_team.team_name END;
  v_team_song     := CASE WHEN input_payload ? 'team_song'
                           THEN nullif(btrim(input_payload->>'team_song'), '')
                           ELSE v_team.team_song END;
  v_spirit_animal := CASE WHEN input_payload ? 'spirit_animal'
                           THEN nullif(btrim(input_payload->>'spirit_animal'), '')
                           ELSE v_team.spirit_animal END;
  v_experience    := CASE WHEN input_payload ? 'experience_level'
                           THEN lower(nullif(btrim(input_payload->>'experience_level'), ''))
                           ELSE v_team.experience_level END;
  IF v_experience NOT IN ('beginner','intermediate','advanced') THEN
    v_experience := v_team.experience_level;
  END IF;
  v_preferred     := CASE WHEN input_payload ? 'preferred_play_times'
                           THEN nullif(btrim(input_payload->>'preferred_play_times'), '')
                           ELSE v_team.preferred_play_times END;
  v_group_label   := CASE WHEN input_payload ? 'group_label'
                           THEN upper(nullif(btrim(input_payload->>'group_label'), ''))
                           ELSE v_team.group_label END;
  IF v_group_label IS NOT NULL AND v_group_label NOT IN ('A','B') THEN
    RAISE EXCEPTION 'group_label must be A or B';
  END IF;

  UPDATE public.league_teams SET
    player1_id           = v_player1,
    player2_id           = v_player2,
    team_name            = v_team_name,
    team_song            = v_team_song,
    spirit_animal        = v_spirit_animal,
    experience_level     = v_experience,
    preferred_play_times = v_preferred,
    group_label          = v_group_label
  WHERE id = input_team_id
  RETURNING * INTO v_team;

  RETURN v_team;
END;
$$;

-- ── admin_delete_league_team ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_delete_league_team(
  input_team_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_team_id IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.league_matches
     WHERE team1_id = input_team_id OR team2_id = input_team_id
  ) THEN
    RAISE EXCEPTION 'cannot delete team with recorded matches';
  END IF;
  DELETE FROM public.league_teams WHERE id = input_team_id;
  RETURN FOUND;
END;
$$;

-- ── admin_confirm_league_groups ───────────────────────────────────────────────
-- Assigns teams to groups A/B, validates assignments, then generates round-robin
-- group-stage fixtures.  Requires ≥ 2 teams per group; groups need not be equal
-- in size.  Single-use per division: re-running after fixtures exist is blocked.

CREATE OR REPLACE FUNCTION public.admin_confirm_league_groups(
  input_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_league_id      uuid   := nullif(btrim(input_payload->>'league_id'), '')::uuid;
  v_assignments    jsonb  := input_payload->'group_assignments';
  v_division       text;
  v_label          text;
  v_team_ids       uuid[];
  v_processed_divs text[] := '{}';
  v_group_count    int;
  v_unique_teams   int;
  div_row          RECORD;
  label_row        RECORD;
BEGIN
  SET LOCAL statement_timeout = '60s';
  PERFORM public.require_admin();

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'league_id is required';
  END IF;
  IF v_assignments IS NULL THEN
    RAISE EXCEPTION 'group_assignments is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = v_league_id) THEN
    RAISE EXCEPTION 'league not found';
  END IF;

  FOR div_row IN SELECT key AS division, value AS groups FROM jsonb_each(v_assignments) LOOP
    v_division := lower(nullif(btrim(div_row.division), ''));
    IF v_division NOT IN ('mens','womens') THEN
      RAISE EXCEPTION 'invalid division: %', div_row.division;
    END IF;
    IF NOT v_division = ANY(v_processed_divs) THEN
      v_processed_divs := array_append(v_processed_divs, v_division);
    END IF;

    FOR label_row IN SELECT key AS label, value AS teams FROM jsonb_each(div_row.groups) LOOP
      v_label := upper(nullif(btrim(label_row.label), ''));
      IF v_label NOT IN ('A','B') THEN
        RAISE EXCEPTION 'invalid group label: %', label_row.label;
      END IF;

      SELECT array_agg(nullif(btrim(team_text), '')::uuid) INTO v_team_ids
        FROM jsonb_array_elements_text(label_row.teams) AS team_text;

      IF v_team_ids IS NULL OR array_length(v_team_ids, 1) < 2 THEN
        RAISE EXCEPTION 'group % % must have at least 2 teams', v_division, v_label;
      END IF;

      SELECT count(DISTINCT team_id) INTO v_unique_teams
        FROM unnest(v_team_ids) AS t(team_id);
      IF v_unique_teams <> array_length(v_team_ids, 1) THEN
        RAISE EXCEPTION 'duplicate team in group % %', v_division, v_label;
      END IF;

      SELECT count(*) INTO v_group_count
        FROM public.league_teams
       WHERE league_id = v_league_id
         AND division  = v_division
         AND id = ANY(v_team_ids);
      IF v_group_count <> array_length(v_team_ids, 1) THEN
        RAISE EXCEPTION 'group % % contains unknown teams', v_division, v_label;
      END IF;

      UPDATE public.league_teams
         SET group_label = v_label
       WHERE league_id = v_league_id
         AND division  = v_division
         AND id = ANY(v_team_ids);
    END LOOP;
  END LOOP;

  IF array_length(v_processed_divs, 1) IS NULL THEN
    RAISE EXCEPTION 'no divisions were assigned';
  END IF;

  -- Verify each processed group has ≥ 2 teams (catches partial overlap bugs)
  SELECT division, group_label, count(*) AS cnt
    INTO v_division, v_label, v_group_count
    FROM public.league_teams
   WHERE league_id = v_league_id
     AND division  = ANY(v_processed_divs)
     AND group_label IN ('A','B')
   GROUP BY division, group_label
   HAVING count(*) < 2
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'division % group % must have at least 2 teams', v_division, v_label;
  END IF;

  -- Block re-generation for already-processed divisions
  FOREACH v_division IN ARRAY v_processed_divs LOOP
    IF EXISTS (
      SELECT 1 FROM public.league_matches
       WHERE league_id = v_league_id
         AND division  = v_division
         AND stage     = 'group'
    ) THEN
      RAISE EXCEPTION 'group matches already generated for division %', v_division;
    END IF;
  END LOOP;

  -- Generate round-robin group fixtures
  INSERT INTO public.league_matches (league_id, division, stage, team1_id, team2_id)
  SELECT v_league_id, gt1.division, 'group', gt1.team_id, gt2.team_id
    FROM (
      SELECT division, group_label, id AS team_id
        FROM public.league_teams
       WHERE league_id = v_league_id
         AND division  = ANY(v_processed_divs)
         AND group_label IN ('A','B')
    ) gt1
    JOIN (
      SELECT division, group_label, id AS team_id
        FROM public.league_teams
       WHERE league_id = v_league_id
         AND division  = ANY(v_processed_divs)
         AND group_label IN ('A','B')
    ) gt2
      ON  gt1.division    = gt2.division
     AND  gt1.group_label = gt2.group_label
     AND  gt1.team_id     < gt2.team_id;

  RETURN 'ok';
END;
$$;

-- ── admin_record_league_match_result ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_record_league_match_result(
  input_payload jsonb
)
RETURNS public.league_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_match_id    uuid := nullif(btrim(input_payload->>'match_id'), '')::uuid;
  v_match       public.league_matches%rowtype;
  v_sets        jsonb := input_payload->'sets';
  v_set         record;
  v_team1_wins  int := 0;
  v_team2_wins  int := 0;
  v_set_count   int;
  v_t1          int;
  v_t2          int;
  v_winner      uuid;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'match_id is required';
  END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = v_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match not found';
  END IF;
  IF v_sets IS NULL THEN
    RAISE EXCEPTION 'sets payload is required';
  END IF;
  v_set_count := jsonb_array_length(v_sets);
  IF v_set_count < 2 OR v_set_count > 3 THEN
    RAISE EXCEPTION 'provide two or three sets';
  END IF;
  FOR v_set IN
    SELECT arr.elem, arr.ord
      FROM jsonb_array_elements(v_sets) WITH ORDINALITY AS arr(elem, ord)
  LOOP
    v_t1 := (v_set.elem->>'t1')::int;
    v_t2 := (v_set.elem->>'t2')::int;
    IF v_set.ord < 3 THEN
      IF v_t1 = v_t2 THEN
        RAISE EXCEPTION 'set % cannot be tied', v_set.ord;
      END IF;
    ELSE
      IF greatest(v_t1, v_t2) < 10 THEN
        RAISE EXCEPTION 'super tiebreak must reach 10 points';
      END IF;
      IF abs(v_t1 - v_t2) < 2 THEN
        RAISE EXCEPTION 'super tiebreak must be decided by two points';
      END IF;
      IF v_team1_wins <> v_team2_wins THEN
        RAISE EXCEPTION 'third set only allowed when first two are split';
      END IF;
    END IF;
    IF v_t1 > v_t2 THEN
      v_team1_wins := v_team1_wins + 1;
    ELSIF v_t2 > v_t1 THEN
      v_team2_wins := v_team2_wins + 1;
    END IF;
  END LOOP;
  IF v_team1_wins = v_team2_wins THEN
    RAISE EXCEPTION 'unable to determine winner';
  END IF;
  v_winner := CASE WHEN v_team1_wins > v_team2_wins
                   THEN v_match.team1_id
                   ELSE v_match.team2_id END;
  UPDATE public.league_matches SET
    set_scores = v_sets,
    winner_id  = v_winner,
    played_on  = COALESCE(nullif(btrim(input_payload->>'played_on'), '')::date, now()::date),
    location   = nullif(btrim(input_payload->>'location'), '')
  WHERE id = v_match_id
  RETURNING * INTO v_match;
  RETURN v_match;
END;
$$;

-- ── admin_create_bracket_matches ──────────────────────────────────────────────
-- Creates knockout-stage match rows.  team2_id may be NULL for a bye; the bye
-- match is immediately awarded to team1 (winner_id set on insert).

CREATE OR REPLACE FUNCTION public.admin_create_bracket_matches(
  input_league_id uuid,
  input_payload   jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_matches  jsonb  := input_payload->'matches';
  v_match    jsonb;
  v_division text;
  v_stage    text;
  v_team1    uuid;
  v_team2    uuid;
  v_checked  text[] := '{}';
  v_key      text;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();

  IF input_league_id IS NULL THEN
    RAISE EXCEPTION 'league_id is required';
  END IF;
  IF v_matches IS NULL OR jsonb_array_length(v_matches) = 0 THEN
    RAISE EXCEPTION 'matches payload is required';
  END IF;

  FOR v_match IN SELECT jsonb_array_elements(v_matches) LOOP
    v_division := lower(nullif(btrim(v_match->>'division'), ''));
    v_stage    := lower(nullif(btrim(v_match->>'stage'), ''));
    v_team1    := nullif(btrim(v_match->>'team1_id'), '')::uuid;
    -- team2_id is optional; NULL signals a bye (team1 advances automatically)
    v_team2    := CASE
                    WHEN v_match ? 'team2_id'
                         AND nullif(btrim(v_match->>'team2_id'), '') IS NOT NULL
                      THEN nullif(btrim(v_match->>'team2_id'), '')::uuid
                    ELSE NULL
                  END;

    IF v_division NOT IN ('mens','womens') THEN
      RAISE EXCEPTION 'invalid division: %', v_match->>'division';
    END IF;
    IF v_stage NOT IN ('gold_semi','silver_semi','gold_final','silver_final') THEN
      RAISE EXCEPTION 'invalid stage: %', v_match->>'stage';
    END IF;
    IF v_team1 IS NULL THEN
      RAISE EXCEPTION 'team1_id is required';
    END IF;
    IF v_team2 IS NOT NULL AND v_team1 = v_team2 THEN
      RAISE EXCEPTION 'team1 and team2 must be different';
    END IF;

    -- Validate that real teams belong to this league/division
    IF v_team2 IS NOT NULL THEN
      IF (
        SELECT count(*) FROM public.league_teams
         WHERE id IN (v_team1, v_team2)
           AND league_id = input_league_id
           AND division  = v_division
      ) <> 2 THEN
        RAISE EXCEPTION 'both teams must belong to the % division of this league', v_division;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.league_teams
         WHERE id          = v_team1
           AND league_id   = input_league_id
           AND division    = v_division
      ) THEN
        RAISE EXCEPTION 'team1 must belong to the % division of this league', v_division;
      END IF;
    END IF;

    -- Guard against duplicate stage entries within this call
    v_key := v_division || '|' || v_stage;
    IF NOT v_key = ANY(v_checked) THEN
      IF EXISTS (
        SELECT 1 FROM public.league_matches
         WHERE league_id = input_league_id
           AND division  = v_division
           AND stage     = v_stage
      ) THEN
        RAISE EXCEPTION 'matches already exist for % %', v_division, v_stage;
      END IF;
      v_checked := array_append(v_checked, v_key);
    END IF;

    INSERT INTO public.league_matches (
      league_id, division, stage, team1_id, team2_id,
      winner_id  -- pre-awarded for bye matches
    ) VALUES (
      input_league_id, v_division, v_stage, v_team1, v_team2,
      CASE WHEN v_team2 IS NULL THEN v_team1 ELSE NULL END
    );
  END LOOP;

  RETURN 'ok';
END;
$$;

-- ── admin_invite_league_player ────────────────────────────────────────────────
-- Promotes a placeholder player to active by assigning an email and a fresh PIN,
-- then triggers a welcome email.
-- TODO: remove the `pin = v_new_pin` write once the plaintext-pin cleanup lands
-- (tracked in CLAUDE.md).  verify_player_pin_v2 currently uses players.pin as
-- its lookup key, so the plaintext write is required until that RPC is updated.

CREATE OR REPLACE FUNCTION public.admin_invite_league_player(
  input_player_id uuid,
  input_email     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_clean_email text := nullif(btrim(input_email), '');
  v_player      public.players%rowtype;
  v_new_pin     text;
BEGIN
  SET LOCAL statement_timeout = '30s';
  PERFORM public.require_admin();
  IF input_player_id IS NULL OR v_clean_email IS NULL THEN
    RAISE EXCEPTION 'player_id and email are required';
  END IF;
  SELECT * INTO v_player FROM public.players WHERE id = input_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player not found';
  END IF;
  IF coalesce(v_player.status, 'active') <> 'placeholder' THEN
    RAISE EXCEPTION 'player is not a placeholder';
  END IF;
  FOR i IN 1..10 LOOP
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.players p
       WHERE p.pin = v_new_pin
         AND coalesce(p.status, 'active') = 'active'
    );
  END LOOP;
  UPDATE public.players SET
    email    = v_clean_email,
    status   = 'active',
    pin      = v_new_pin,       -- required by verify_player_pin_v2 lookup; see TODO above
    pin_hash = extensions.crypt(v_new_pin, extensions.gen_salt('bf', 10))
  WHERE id = input_player_id;
  INSERT INTO public.pin_attempts(player_id, attempt_kind, succeeded)
  VALUES (input_player_id, 'admin_action', true);
  PERFORM private.send_pin_email(input_player_id, v_new_pin, 'new_signup');
  RETURN 'ok';
END;
$$;
