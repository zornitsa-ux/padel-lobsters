-- ============================================================================
-- Event system EV1: finished in the database (docs/event-system/, DESIGN §2–§3,
-- CONTRACTS C-1, DECISIONS EV-D1, EV-D3, EV-D4).
--
-- An event is finished at its scheduled end (start + duration), or once its
-- ratings are applied (status = 'completed'). Every reader that took
-- 'completed' to mean "over" now asks private.event_finished. Admin paths keep
-- the 'completed' gate (EV-D3). Bodies are copied from their latest migration;
-- only the status test changes, plus the finished check in the two register
-- functions.
-- ============================================================================

-- ── 1. Start, end and finished (C-1) ────────────────────────────────────────

-- A missing time means 19:00, as the client (EV-D4). Was 00:00. So does a time
-- that isn't HH:MM (or HH.MM): readers of finished run per row, and one bad
-- value must not make them raise.
create or replace function public.tournament_start_ts(input_tournament_id uuid)
returns timestamptz language sql stable security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
  select (t.date::text || ' ' ||
          case when btrim(t.time) ~ '^([01]?[0-9]|2[0-3])[:.][0-5][0-9]$'
               then replace(btrim(t.time), '.', ':') else '19:00' end)::timestamp
         at time zone 'Europe/Amsterdam'
    from public.tournaments t where t.id = input_tournament_id
$function$;
revoke all on function public.tournament_start_ts(uuid) from public, anon, authenticated;
grant execute on function public.tournament_start_ts(uuid) to service_role;

-- Null when the event has no date.
create or replace function public.tournament_end_ts(input_tournament_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
  select public.tournament_start_ts(t.id) + make_interval(mins => coalesce(t.duration, 90))
    from public.tournaments t where t.id = input_tournament_id
$function$;
revoke all on function public.tournament_end_ts(uuid) from public, anon, authenticated;
grant execute on function public.tournament_end_ts(uuid) to service_role;

-- False with no date, unless ratings were applied.
create or replace function private.event_finished(input_tournament_id uuid, input_now timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
  select coalesce(t.status = 'completed' or input_now >= public.tournament_end_ts(t.id), false)
    from public.tournaments t where t.id = input_tournament_id
$function$;
revoke all on function private.event_finished(uuid, timestamptz) from public, anon, authenticated;

-- ── 2. Played nights, live events and team invites ─────────────────────────

-- A played night: a tournament or seed rating event, or a registered row in a
-- finished tournament (team and King of the Court nights write no rating
-- events).
create or replace function private.has_played_night(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
           select 1 from public.rating_events e
            where e.player_id = input_player_id
              and e.kind in ('tournament', 'seed'))
      or exists (
           select 1 from public.registrations r
             join public.tournaments t on t.id = r.tournament_id
            where r.player_id = input_player_id
              and r.status = 'registered'
              and private.event_finished(t.id));
$function$;
revoke all on function private.has_played_night(uuid) from public, anon, authenticated;

-- An event dated today or earlier that isn't finished yet. After the end the
-- account can go: ratings can still be applied to a deleted player.
create or replace function private.in_live_event(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
      from public.registrations r
      join public.tournaments t on t.id = r.tournament_id
     where r.player_id = input_player_id
       and r.status in ('registered', 'waitlist')
       and not private.event_finished(t.id)
       and t.date <= (now() at time zone 'Europe/Amsterdam')::date
  )
$function$;
revoke all on function private.in_live_event(uuid) from public, anon, authenticated;

create or replace function public.get_my_team_invites()
returns table(
  team_id uuid,
  tournament_id uuid,
  tournament_name text,
  tournament_date date,
  tournament_time text,
  captain_id uuid,
  captain_name text,
  team_status text,
  account_created_by_captain boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  return query
    select et.id, t.id, t.name, t.date, t.time, et.captain_id, btrim(p.name), r.status,
           exists (select 1 from public.partner_invites pi
                    where pi.player_id = auth.uid() and pi.tournament_id = t.id)
      from public.registrations r
      join public.event_teams et on et.id = r.team_id
      join public.tournaments t on t.id = et.tournament_id
      join public.players p on p.id = et.captain_id
     where r.player_id = auth.uid()
       and r.player_id <> et.captain_id
       and r.status in ('registered', 'waitlist')
       and r.accepted_at is null
       and not private.event_finished(t.id)
     order by t.date, t.time;
end
$function$;
revoke all on function public.get_my_team_invites() from public, anon, authenticated;
grant execute on function public.get_my_team_invites() to authenticated;

-- ── 3. Account deletion: spots in events not finished count as upcoming ──

create or replace function private.deletion_summary(input_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with active as (
    select r.*, t.name as t_name, t.date as t_date
      from public.registrations r
      join public.tournaments t on t.id = r.tournament_id
     where r.player_id = input_player_id
       and r.status in ('registered', 'waitlist')
       and not private.event_finished(t.id)
  )
  select jsonb_build_object(
    'is_admin', coalesce((select p.role = 'admin' from public.players p where p.id = input_player_id), false),
    'in_live_event', private.in_live_event(input_player_id),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tournament_id', a.tournament_id, 'name', a.t_name, 'date', a.t_date,
               'paid', a.payment_status in ('paid', 'tikkied', 'pending_confirmation'),
               'team', a.team_id is not null)
             order by a.t_date, a.tournament_id)
        from active a), '[]'::jsonb),
    'team_events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tournament_id', a.tournament_id, 'name', a.t_name,
               'is_captain', et.captain_id = input_player_id)
             order by a.t_date, a.tournament_id)
        from active a
        join public.event_teams et on et.id = a.team_id), '[]'::jsonb),
    'league_teams', coalesce((
      select jsonb_agg(jsonb_build_object('league_id', l.id, 'league_name', l.name) order by l.name)
        from public.league_teams lt
        join public.leagues l on l.id = lt.league_id
       where input_player_id in (lt.player1_id, lt.player2_id)
         and l.status <> 'completed'), '[]'::jsonb),
    'open_shop_requests', (
      select count(*) from public.merch_interests mi
       where mi.player_id = input_player_id::text
         and coalesce(mi.status, '') not in ('cancelled', 'delivered')
         and not coalesce(mi.delivered, false)),
    'pending_transfers', (
      select count(*) from public.registration_transfers x
       where x.status = 'pending'
         and input_player_id in (x.from_player_id, x.to_player_id))
  )
$function$;
revoke all on function private.deletion_summary(uuid) from public, anon, authenticated;

create or replace function private.delete_account(input_target_id uuid, input_by_admin boolean)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_player public.players%rowtype;
  v_name text;
  v_row record;
  v_other uuid;
  v_other_accepted boolean;
  v_was_captain boolean;
begin
  perform set_config('app.audit_source',
    case when input_by_admin then 'admin_delete_account' else 'delete_my_account' end, true);

  -- No key update: registrations' foreign key takes key share on this row,
  -- and a concurrent registration must not deadlock against the deletion.
  select * into v_player from public.players p where p.id = input_target_id for no key update;
  if not found or v_player.status = 'deleted' then
    return null;
  end if;
  v_name := private.anonymised_name(nextval('private.deleted_player_number'));

  -- 1. Where the name may sit in free text, before it's wiped.
  perform private.record_deletion_followups(input_target_id, v_player.name);

  -- 2. Upcoming individual spots, as an admin cancel: the waitlist moves up.
  for v_row in
    select r.id
      from public.registrations r
      join public.tournaments t on t.id = r.tournament_id
     where r.player_id = input_target_id
       and r.team_id is null
       and r.status in ('registered', 'waitlist')
       and not private.event_finished(t.id)
     order by t.id
  loop
    perform private.cancel_registration_row(v_row.id);
  end loop;

  -- 3. Team spots stay with the pair (D-3): the partner becomes captain. The
  -- team is cancelled instead when the partner is deleted too, or when the
  -- captain goes before the partner ever accepted.
  for v_row in
    select r.team_id
      from public.registrations r
      join public.tournaments t on t.id = r.tournament_id
     where r.player_id = input_target_id
       and r.team_id is not null
       and r.status in ('registered', 'waitlist')
       and not private.event_finished(t.id)
     order by t.id
  loop
    perform private.lock_team(v_row.team_id);
    select r.player_id, r.accepted_at is not null into v_other, v_other_accepted
      from public.registrations r
     where r.team_id = v_row.team_id
       and r.status in ('registered', 'waitlist')
       and r.player_id <> input_target_id;
    select et.captain_id = input_target_id into v_was_captain
      from public.event_teams et where et.id = v_row.team_id;
    if v_other is null or public.is_deleted_player(v_other)
       or (v_was_captain and not v_other_accepted) then
      perform private.cancel_team_rows(v_row.team_id, 'account_deleted');
    else
      update public.event_teams et set captain_id = v_other
       where et.id = v_row.team_id and et.captain_id = input_target_id;
    end if;
  end loop;

  -- 4. Pending spot transfers from or to them.
  update public.registration_transfers x
     set status = 'cancelled', closed_reason = 'account_deleted', closed_at = now()
   where x.status = 'pending'
     and input_target_id in (x.from_player_id, x.to_player_id);

  -- 5. Partner invites for them. Rows they sent keep the uuid.
  delete from public.partner_invites pi where pi.player_id = input_target_id;

  -- 6. Shop: open requests cancelled, every custom name of theirs cleared.
  update public.merch_interests mi
     set status = 'cancelled', cancelled_at = now()
   where mi.player_id = input_target_id::text
     and coalesce(mi.status, '') not in ('cancelled', 'delivered')
     and not coalesce(mi.delivered, false);
  update public.merch_interests mi
     set custom_name = null
   where mi.player_id = input_target_id::text and mi.custom_name is not null;

  -- 7. Rows that only matter while they're a member (D-9).
  delete from public.player_aliases where player_id = input_target_id;
  delete from public.player_email_clears where player_id = input_target_id;
  delete from public.player_levelling where player_id = input_target_id;
  delete from public.player_signup_source where player_id = input_target_id;
  delete from public.league_interests where player_id = input_target_id;
  delete from public.tournament_reminders_sent where player_id = input_target_id;
  delete from public.raffle_exclusions where player_id = input_target_id;
  delete from public.security_events where player_id = input_target_id;

  -- 8. The row: anonymised name, nothing personal. Ratings are kept.
  perform set_config('app.deleting_player', input_target_id::text, true);
  update public.players p
     set name = v_name,
         status = 'deleted',
         email = null,
         phone = '',
         notes = '',
         playtomic_level = null,
         playtomic_username = '',
         playtomic_updated_at = null,
         gender = '',
         country = '',
         birthday = null,
         tagline = '',
         tagline_label = '',
         avatar_url = '',
         preferred_position = '',
         is_left_handed = false
   where p.id = input_target_id;
  perform set_config('app.deleting_player', '', true);

  -- 9. The sign-in account; sessions, refresh tokens and identities cascade.
  delete from auth.users u where u.id = input_target_id;

  -- 10. One line saying it happened, and who started it.
  insert into public.security_events(player_id, attempt_kind, succeeded)
  values (input_target_id,
          case when input_by_admin then 'account_deleted_admin' else 'account_deleted_self' end,
          true);

  return v_name;
end
$function$;
revoke all on function private.delete_account(uuid, boolean) from public, anon, authenticated;

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
   where not private.event_finished(t.id) and et.cancelled_at is null
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
revoke all on function public.admin_list_deletion_followups() from public, anon, authenticated;
grant execute on function public.admin_list_deletion_followups() to authenticated;

-- ── 4. Signups: a player is refused once finished; an admin as today (EV-D3)

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
  v_entry_mode text;
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

  select t.max_players, t.entry_mode into v_max, v_entry_mode
    from public.tournaments t where t.id = input_tournament_id
   for update;
  if not found then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if v_entry_mode = 'team' then
    return query select 'team_event'::text, null::uuid; return;
  end if;
  if not private.caller_is_admin() and private.event_finished(input_tournament_id) then
    return query select 'event_finished'::text, null::uuid; return;
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
  if private.needs_levelling(input_player_id) then
    return query
      select (case when input_player_id = auth.uid() then 'needs_level' else 'player_needs_level' end)::text,
             null::uuid;
    return;
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
revoke all on function public.register_for_tournament(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_for_tournament(uuid, uuid) to authenticated;

create or replace function public.register_team_for_tournament(
  input_tournament_id uuid,
  input_captain_id uuid,
  input_partner_id uuid default null,
  input_new_partner jsonb default null,
  input_partner_consent boolean default false
)
returns table(status text, team_id uuid, partner_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_t public.tournaments%rowtype;
  v_existing public.registrations%rowtype;
  v_partner record;
  v_count integer;
  v_status text;
  v_team_id uuid;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'register_team_for_tournament', true);

  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if input_captain_id is distinct from auth.uid() then
    perform public.require_admin();
  end if;

  select * into v_t from public.tournaments t where t.id = input_tournament_id for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid; return;
  end if;
  if v_t.entry_mode <> 'team' then
    return query select 'not_team_event'::text, null::uuid, null::uuid; return;
  end if;
  if v_t.status = 'completed' then
    return query select 'tournament_completed'::text, null::uuid, null::uuid; return;
  end if;
  if not private.caller_is_admin() and private.event_finished(input_tournament_id) then
    return query select 'event_finished'::text, null::uuid, null::uuid; return;
  end if;
  if not exists (
    select 1 from public.players p where p.id = input_captain_id and p.status = 'active'
  ) then
    return query select 'captain_not_active'::text, null::uuid, null::uuid; return;
  end if;

  -- A double tap lands here: report the team rather than tripping the
  -- active-row unique index.
  select * into v_existing
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.player_id = input_captain_id
     and r.status in ('registered', 'waitlist')
   limit 1;
  if found then
    return query
      select ('already_' || v_existing.status)::text, v_existing.team_id,
             (select r.player_id from public.registrations r
               where r.team_id = v_existing.team_id
                 and r.player_id <> input_captain_id
                 and r.status in ('registered', 'waitlist')
               limit 1);
    return;
  end if;
  -- Before resolve_team_partner, which can create the partner's player row.
  if private.needs_levelling(input_captain_id) then
    return query
      select (case when input_captain_id = auth.uid() then 'needs_level' else 'captain_needs_level' end)::text,
             null::uuid, null::uuid;
    return;
  end if;

  select * into v_partner from private.resolve_team_partner(
    input_tournament_id, input_captain_id, input_partner_id, input_new_partner, input_partner_consent);
  if v_partner.status <> 'ok' then
    return query select v_partner.status, null::uuid, null::uuid; return;
  end if;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = input_tournament_id and r.status = 'registered';
  v_status := case when v_count + 2 <= v_t.max_players then 'registered' else 'waitlist' end;

  insert into public.event_teams(tournament_id, captain_id, created_by)
  values (input_tournament_id, input_captain_id, auth.uid())
  returning id into v_team_id;

  insert into public.registrations(tournament_id, player_id, status, payment_status, payment_method, team_id, accepted_at)
  values (input_tournament_id, input_captain_id, v_status, 'unpaid', '', v_team_id, now()),
         (input_tournament_id, v_partner.player_id, v_status, 'covered', '', v_team_id, null);

  return query select v_status, v_team_id, v_partner.player_id;
end
$function$;
revoke all on function public.register_team_for_tournament(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.register_team_for_tournament(uuid, uuid, uuid, jsonb, boolean) to authenticated;

-- ── 5. Reminders skip finished events ─────────────────────────────────────

create or replace function private.send_tournament_reminders()
returns table(out_tournament_id uuid, out_tournament_name text, recipients_attempted integer, recipients_sent integer, recipients_failed integer, recipients_skipped integer)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'net'
as $function$
declare
  v_url_batch  text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-tournament-reminders-batch';
  v_url_report text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-tournament-reminder-report';
  v_chunk_size constant int := 4;
  v_chunk_pause constant numeric := 10.0;
  v_settle constant numeric := 15.0;
  v_key text; v_t record; v_recipients jsonb;
  v_chunk_total int; v_chunk_idx int; v_chunk_recipients jsonb;
  v_chunk_pids text[]; v_chunk_req bigint; v_results jsonb; v_item jsonb;
  v_total int; v_sent int; v_failed int; v_skipped int;
  v_failed_list jsonb; v_run_at timestamptz := now();
begin
  set local statement_timeout = '300s';
  v_key := private.get_edge_service_role_key();
  if v_key is null then raise exception 'send_tournament_reminders: vault secret missing'; end if;
  for v_t in
    select t.id, t.name, t.location,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDay') as day_full,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMonth, HH24:MI') as subject_date,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDD FMMonth') as date_long,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'HH24:MI') as time_hm
    from public.tournaments t
    where not private.event_finished(t.id)
      and ((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam')
          between now() + interval '47 hours' and now() + interval '49 hours'
  loop
    insert into public.tournament_reminders_sent(tournament_id, player_id, status, sent_at, error)
    select v_t.id, p.id, 'skipped_no_email', now(), null
      from public.registrations r join public.players p on p.id = r.player_id
     where r.tournament_id = v_t.id and r.status = 'registered'
       and (p.email is null or length(trim(p.email)) < 3 or p.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
       and not exists (select 1 from public.tournament_reminders_sent s
         where s.tournament_id = v_t.id and s.player_id = p.id and s.status in ('sent', 'skipped_no_email'))
    on conflict (tournament_id, player_id) do update set status = 'skipped_no_email', sent_at = now(), error = null;
    select coalesce(jsonb_agg(jsonb_build_object(
             'player_id', p.id::text, 'first_name', private.first_name(p.name), 'email', p.email
           )), '[]'::jsonb) into v_recipients
      from public.registrations r join public.players p on p.id = r.player_id
     where r.tournament_id = v_t.id and r.status = 'registered'
       and p.email is not null and length(trim(p.email)) >= 3
       and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       and not exists (select 1 from public.tournament_reminders_sent s
         where s.tournament_id = v_t.id and s.player_id = p.id and s.status in ('sent', 'skipped_no_email'));
    if jsonb_array_length(v_recipients) = 0 then continue; end if;
    v_chunk_total := ceil(jsonb_array_length(v_recipients)::numeric / v_chunk_size)::int;
    for v_chunk_idx in 0 .. v_chunk_total - 1 loop
      select coalesce(jsonb_agg(rec ORDER BY ord), '[]'::jsonb) into v_chunk_recipients
        from jsonb_array_elements(v_recipients) WITH ORDINALITY AS t(rec, ord)
       where ord > v_chunk_idx * v_chunk_size and ord <= (v_chunk_idx + 1) * v_chunk_size;
      select array_agg(rec ->> 'player_id') into v_chunk_pids from jsonb_array_elements(v_chunk_recipients) AS rec;
      insert into public.tournament_reminders_sent(tournament_id, player_id, status, sent_at, error)
      select v_t.id, pid::uuid, 'queued', now(), null from unnest(v_chunk_pids) AS pid
      on conflict (tournament_id, player_id) do update set status = 'queued', sent_at = now(), error = null;
      select net.http_post(
        url := v_url_batch,
        body := jsonb_build_object(
          'tournament_id', v_t.id::text, 'tournament_name', v_t.name, 'location', v_t.location,
          'day_full', trim(v_t.day_full), 'date_long', trim(v_t.date_long), 'time_hm', trim(v_t.time_hm),
          'subject_date', trim(v_t.subject_date), 'recipients', v_chunk_recipients),
        headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
        timeout_milliseconds := 30000
      ) into v_chunk_req;
      update public.tournament_reminders_sent set net_request_id = v_chunk_req
       where tournament_id = v_t.id and player_id = ANY(SELECT pid::uuid FROM unnest(v_chunk_pids) AS pid) and status = 'queued';
      if v_chunk_idx < v_chunk_total - 1 then perform pg_sleep(v_chunk_pause); end if;
    end loop;
    perform pg_sleep(v_settle);
    for v_chunk_req in select distinct net_request_id from public.tournament_reminders_sent where tournament_id = v_t.id and status = 'queued'
    loop
      select content::jsonb -> 'results' into v_results from net._http_response where id = v_chunk_req;
      if v_results is null then continue; end if;
      for v_item in select * from jsonb_array_elements(v_results)
      loop
        if (v_item ->> 'ok')::boolean is true then
          update public.tournament_reminders_sent set status = 'sent', error = null, sent_at = now()
           where tournament_id = v_t.id and player_id = (v_item ->> 'player_id')::uuid;
        else
          update public.tournament_reminders_sent
             set status = 'failed', error = coalesce(v_item ->> 'error', 'unknown'), sent_at = now()
           where tournament_id = v_t.id and player_id = (v_item ->> 'player_id')::uuid;
        end if;
      end loop;
    end loop;
    select count(*) filter (where status='sent'), count(*) filter (where status='failed'),
           count(*) filter (where status='skipped_no_email')
      into v_sent, v_failed, v_skipped from public.tournament_reminders_sent where tournament_id = v_t.id;
    select count(*) into v_total from public.registrations where tournament_id = v_t.id and status = 'registered';
    select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'email', p.email, 'error', s.error) order by p.name), '[]'::jsonb)
      into v_failed_list from public.tournament_reminders_sent s join public.players p on p.id = s.player_id
     where s.tournament_id = v_t.id and s.status = 'failed';
    perform net.http_post(
      url := v_url_report,
      body := jsonb_build_object(
        'tournament_id', v_t.id::text, 'tournament_name', v_t.name, 'subject_date', trim(v_t.subject_date),
        'run_at_amsterdam', to_char(v_run_at at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMonth, HH24:MI'),
        'total_registered', v_total, 'sent_count', v_sent, 'failed_count', v_failed,
        'skipped_count', v_skipped, 'failed_list', v_failed_list),
      headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
      timeout_milliseconds := 10000);
    out_tournament_id := v_t.id; out_tournament_name := v_t.name;
    recipients_attempted := jsonb_array_length(v_recipients);
    recipients_sent := v_sent; recipients_failed := v_failed; recipients_skipped := v_skipped;
    return next;
  end loop;
  return;
end;
$function$;
