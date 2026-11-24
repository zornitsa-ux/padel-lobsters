-- ============================================================================
-- Deleted accounts in the raffle and the Oscars (docs/account-deletion AD3, C-6).
-- A deleted account keeps its registration in a past event, so it was still
-- in the raffle pool and could still be voted for. raffle_winners and
-- lobster_oscars_votes refuse a deleted player (refuse_link_to_deleted_player),
-- so a draw that picked one failed as a whole, and a vote raised instead of
-- answering. The draw now skips deleted players; a vote for one is
-- invalid_target.
-- Follow-ups: a note on a player who was deleted afterwards is no longer
-- listed, since that deletion wiped the note and the page can't edit it.
-- Grants are unchanged (create or replace keeps them).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winners(input_tournament_id uuid, input_num_winners integer, input_prizes text[] DEFAULT NULL::text[])
 RETURNS SETOF raffle_winners
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_t_date   date;
  v_t_name   text;
  v_cooldown int;
  v_picked   uuid[];
  v_pid      uuid;
  v_prize    text;
  v_idx      int;
  v_row      public.raffle_winners%rowtype;
  v_n        int;
BEGIN
  SET LOCAL statement_timeout = '15s';
  PERFORM public.require_admin();
  IF input_tournament_id IS NULL THEN RETURN; END IF;

  SELECT date, name INTO v_t_date, v_t_name
    FROM public.tournaments WHERE id = input_tournament_id;
  IF v_t_date IS NULL THEN RETURN; END IF;

  SELECT coalesce(raffle_cooldown_tournaments, 2) INTO v_cooldown
    FROM public.settings WHERE id = 1;
  v_cooldown := coalesce(v_cooldown, 2);
  v_n := greatest(coalesce(input_num_winners, 1), 0);
  IF v_n = 0 THEN RETURN; END IF;

  -- Compute the eligible pool and pick the winners in one shot.
  SELECT array_agg(player_id) INTO v_picked
    FROM (
      SELECT r.player_id
        FROM (
          SELECT DISTINCT r.player_id
            FROM public.registrations r
           WHERE r.tournament_id = input_tournament_id
             AND r.status = 'registered'
             -- a deleted account keeps its row in a past event, but can't win
             AND NOT public.is_deleted_player(r.player_id)
             -- admin removed them from this tournament's draw
             AND NOT EXISTS (
               SELECT 1 FROM public.raffle_exclusions x
                WHERE x.tournament_id = input_tournament_id
                  AND x.player_id = r.player_id
             )
             -- already won this tournament's raffle
             AND NOT EXISTS (
               SELECT 1 FROM public.raffle_winners w
                WHERE w.player_id = r.player_id
                  AND w.tournament_id = input_tournament_id
             )
             -- cooldown: a prior win with fewer than v_cooldown tournaments since
             AND NOT EXISTS (
               SELECT 1 FROM public.raffle_winners w
                WHERE w.player_id = r.player_id
                  AND w.won_at_date < v_t_date
                  AND (
                    SELECT count(*) FROM public.tournaments t
                     WHERE t.date > w.won_at_date AND t.date < v_t_date
                  ) + coalesce(w.cooldown_offset, 0) < v_cooldown
             )
        ) r
       ORDER BY random()
       LIMIT v_n
    ) picked;

  IF v_picked IS NULL THEN RETURN; END IF;

  v_idx := 1;
  FOREACH v_pid IN ARRAY v_picked LOOP
    v_prize := NULL;
    IF input_prizes IS NOT NULL AND v_idx <= array_length(input_prizes, 1) THEN
      v_prize := input_prizes[v_idx];
    END IF;
    v_idx := v_idx + 1;

    INSERT INTO public.raffle_winners
      (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
    VALUES
      (v_pid, input_tournament_id, v_t_date, v_t_name, 0, v_prize)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.lobster_oscars_cast_vote(input_category_id uuid, input_target_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_voter_id uuid;
  v_session_id uuid;
  v_tournament_id uuid;
  v_started_at timestamptz;
  v_closed_at timestamptz;
  v_voter_registered boolean;
  v_target_registered boolean;
  v_existed boolean;
BEGIN
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;
  IF v_voter_id = input_target_id THEN RETURN 'self_vote'; END IF;
  SELECT c.session_id, s.tournament_id, s.started_at, s.closed_at
    INTO v_session_id, v_tournament_id, v_started_at, v_closed_at
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_session_id IS NULL THEN RETURN 'invalid_category'; END IF;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
     WHERE r.tournament_id = v_tournament_id
       AND r.player_id = v_voter_id
       AND r.status = 'registered'
  ) INTO v_voter_registered;
  IF NOT v_voter_registered THEN RETURN 'voter_not_registered'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
     WHERE r.tournament_id = v_tournament_id
       AND r.player_id = input_target_id
       AND r.status = 'registered'
  ) AND NOT public.is_deleted_player(input_target_id) INTO v_target_registered;
  IF NOT v_target_registered THEN RETURN 'invalid_target'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.lobster_oscars_votes
     WHERE category_id = input_category_id AND voter_id = v_voter_id
  ) INTO v_existed;
  INSERT INTO public.lobster_oscars_votes (category_id, voter_id, target_id)
  VALUES (input_category_id, v_voter_id, input_target_id)
  ON CONFLICT (category_id, voter_id) DO UPDATE
    SET target_id = EXCLUDED.target_id, updated_at = now();
  RETURN CASE WHEN v_existed THEN 'updated' ELSE 'voted' END;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_deletion_followups()
 RETURNS TABLE(kind text, ref_table text, ref_id text, ref_column text, player_name text, followup_id bigint, context_id text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.require_admin();
  return query
  select 'league_team'::text, 'league_teams'::text, lt.id::text, null::text, p.name, null::bigint, lt.league_id::text
    from public.league_teams lt
    join public.leagues l on l.id = lt.league_id
    join public.players p on p.id in (lt.player1_id, lt.player2_id) and p.status = 'deleted'
   where l.status <> 'completed'
  union all
  select 'event_team', 'event_teams', et.id::text, null, p.name, null, et.tournament_id::text
    from public.event_teams et
    join public.tournaments t on t.id = et.tournament_id
    join public.registrations r on r.team_id = et.id and r.status in ('registered', 'waitlist')
    join public.players p on p.id = r.player_id and p.status = 'deleted'
   where t.status <> 'completed' and et.cancelled_at is null
  union all
  select 'free_text', f.ref_table, f.ref_id, f.ref_column, p.name, f.id,
         case f.ref_table
           when 'league_teams' then (select lt.league_id::text from public.league_teams lt where lt.id::text = f.ref_id)
           when 'merch_interests' then (select mi.merch_item_id::text from public.merch_interests mi where mi.id::text = f.ref_id)
           else f.ref_id
         end
    from public.account_deletion_followups f
    join public.players p on p.id = f.player_id
   where f.dismissed_at is null
     -- notes on a player deleted since: the deletion wiped them
     and not (f.ref_table = 'players' and public.is_deleted_player(f.ref_id::uuid))
   order by 1, 5, 3;
end
$function$;
