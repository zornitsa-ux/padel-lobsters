-- ============================================================================
-- Signup revamp S6c: no spot in an event without a level, whoever writes it
-- (docs/signup-revamp/, DECISIONS D-18, owner 23 Nov).
--
-- S3 gated only the caller's own row. A captain could still pick an existing
-- member with no level as partner, and an admin could register one; an
-- unaccepted partner plays, so they could play without a level. Now:
--   - resolve_team_partner refuses an existing partner who needs levelling
--     (partner_needs_level), for register_team_for_tournament and
--     change_team_partner, captains and admins alike;
--   - register_for_tournament and register_team_for_tournament refuse a player
--     or captain who needs levelling when an admin registers them
--     (player_needs_level, captain_needs_level);
--   - the backstop trigger checks every row that becomes active, not only the
--     caller's own.
-- Writes with no caller (service role, migrations) and rows already active
-- (waitlist promotion, payment updates) still pass, as in S3.
-- ============================================================================

-- ── 1. Partner check (register_team_for_tournament, change_team_partner) ────
-- Body as in 20261022120000_team_events.sql, plus the needs_levelling check.

create or replace function private.resolve_team_partner(
  input_tournament_id uuid,
  input_exclude_player_id uuid,
  input_partner_id uuid,
  input_new_partner jsonb,
  input_consent boolean
)
returns table(status text, player_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  if (input_partner_id is null) = (input_new_partner is null)
     or input_partner_id = input_exclude_player_id then
    return query select 'invalid_partner'::text, null::uuid; return;
  end if;

  if input_new_partner is not null then
    return query select * from private.create_partner_player(
      auth.uid(), input_tournament_id, input_new_partner, input_consent, private.caller_is_admin());
    return;
  end if;

  if not exists (
    select 1 from public.players p where p.id = input_partner_id and p.status = 'active'
  ) then
    return query select 'partner_not_active'::text, null::uuid; return;
  end if;
  if exists (
    select 1 from public.registrations r
     where r.tournament_id = input_tournament_id
       and r.player_id = input_partner_id
       and r.status in ('registered', 'waitlist')
  ) then
    return query select 'partner_already_entered'::text, null::uuid; return;
  end if;
  if private.needs_levelling(input_partner_id) then
    return query select 'partner_needs_level'::text, null::uuid; return;
  end if;
  return query select 'ok'::text, input_partner_id;
end
$function$;

revoke execute on function private.resolve_team_partner(uuid, uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;

-- ── 2. Admins registering a player or captain with no level ─────────────────
-- Bodies as in 20261116120000_registration_gate.sql; only the needs_level
-- check changes: it no longer skips admins acting for someone else.

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

-- ── 3. Backstop trigger: every row, not only the caller's own (C-6) ─────────

create or replace function private.registrations_require_levelling()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (
       new.status in ('registered', 'waitlist')
       and (tg_op = 'INSERT' or old.status not in ('registered', 'waitlist'))
     )
     or (tg_op = 'UPDATE' and old.accepted_at is null and new.accepted_at is not null)
  then
    if private.needs_levelling(new.player_id) then
      raise exception 'needs_level' using errcode = 'P0001';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function private.registrations_require_levelling() from public, anon, authenticated;
