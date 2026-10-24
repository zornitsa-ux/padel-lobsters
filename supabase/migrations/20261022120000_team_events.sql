-- ============================================================================
-- Team events (docs/team-events, T1). The one migration for the initiative:
-- Phase 2 (King of the Court seeding and final standings) writes only columns
-- created here.
--
-- Contracts: docs/team-events/CONTRACTS.md. Registrations stay the per-player
-- truth; a team is a grouping on top (DESIGN F-1). Only the team RPCs write
-- team rows, and the database enforces that the pair never diverges.
--
-- Lock order is the house order from 20260806211259: tournaments row first,
-- then registrations.
-- ============================================================================

-- ── 1. Columns and tables ───────────────────────────────────────────────────

alter table public.tournaments
  add column entry_mode text not null default 'individual',
  add column starting_courts_published_at timestamptz,
  add constraint tournaments_entry_mode_check check (entry_mode in ('individual', 'team')),
  add constraint tournaments_format_check check (format in ('lobster_matching', 'king_of_court')),
  add constraint tournaments_kotc_is_team check (format is distinct from 'king_of_court' or entry_mode = 'team'),
  -- D-004: capacity stays in players; a team event holds whole teams.
  add constraint tournaments_team_capacity_even check (entry_mode <> 'team' or max_players % 2 = 0);

create table public.event_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete restrict,
  captain_id uuid not null references public.players(id),
  seed integer check (seed > 0),
  final_rank integer check (final_rank > 0),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references public.players(id) on delete set null,
  -- Why the team stopped being active, so the captain can be told (D-015).
  cancelled_at timestamptz,
  cancelled_reason text check (cancelled_reason in ('partner_declined', 'captain_cancelled', 'admin_cancelled'))
);
create index event_teams_tournament_id_idx on public.event_teams(tournament_id);

-- accepted_at is null only for a team partner who hasn't accepted yet (D-015).
-- Every other row is accepted when written; rows that predate team events hold
-- this migration's time.
alter table public.registrations
  add column team_id uuid references public.event_teams(id) on delete restrict,
  add column accepted_at timestamptz default now();
create index registrations_team_id_idx on public.registrations(team_id) where team_id is not null;

-- D-005: the partner's row on a team carries no payment of its own.
alter table public.registrations drop constraint registrations_payment_status_check;
alter table public.registrations add constraint registrations_payment_status_check
  check (payment_status = any (array['unpaid', 'tikkied', 'pending_confirmation', 'paid', 'transferred', 'covered']));

-- Provenance for accounts a captain created (D-010, D-011). The email lives on
-- players.email under the normal PII scoping; this table holds no PII.
create table public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  requested_by uuid not null references public.players(id),
  consent_confirmed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  invited_at timestamptz,
  invited_by uuid references public.players(id),
  -- The partner confirms the account is theirs at first sign-in (D-021).
  account_acknowledged_at timestamptz
);
create index partner_invites_requested_by_idx on public.partner_invites(requested_by, created_at);

-- ── 2. Access ───────────────────────────────────────────────────────────────

-- D-016: registrations are written only through security-definer RPCs, each
-- allowing one specific change. Reads are unchanged.
drop policy registrations_self_insert on public.registrations;
drop policy registrations_self_update on public.registrations;
drop policy registrations_admin_write on public.registrations;
revoke insert, update, delete on public.registrations from anon, authenticated;

alter table public.event_teams enable row level security;
alter table public.partner_invites enable row level security;

revoke all on public.event_teams from public, anon, authenticated;
revoke all on public.partner_invites from public, anon, authenticated;

grant select on public.event_teams to authenticated;
-- Phase 2 seeding and final standings are admin edits of these two columns.
grant update (seed, final_rank) on public.event_teams to authenticated;
grant select on public.partner_invites to authenticated;

create policy event_teams_read_all on public.event_teams
  for select to authenticated using (true);
create policy event_teams_admin_update on public.event_teams
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy partner_invites_admin_read on public.partner_invites
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 3. Invariants ───────────────────────────────────────────────────────────

-- Clients can't write registrations at all (D-016); this keeps every RPC
-- honest about which events take teams.
create or replace function public.registrations_guard_team_rows()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_entry_mode text;
begin
  select t.entry_mode into v_entry_mode from public.tournaments t where t.id = NEW.tournament_id;

  if v_entry_mode is distinct from 'team' then
    if NEW.team_id is not null then
      raise exception 'team_not_allowed' using errcode = 'P0001';
    end if;
    return NEW;
  end if;

  if NEW.status in ('registered', 'waitlist') and NEW.team_id is null then
    raise exception 'team_required' using errcode = 'P0001';
  end if;
  return NEW;
end
$function$;

create trigger registrations_guard_team_rows
  before insert or update on public.registrations
  for each row execute function public.registrations_guard_team_rows();

-- Checked at commit, so an RPC can cancel one partner and insert the next.
create or replace function public.registrations_team_consistent()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_active integer;
  v_statuses integer;
  v_has_captain boolean;
begin
  select count(*),
         count(distinct r.status),
         coalesce(bool_or(r.player_id = et.captain_id), false)
    into v_active, v_statuses, v_has_captain
    from public.event_teams et
    left join public.registrations r
      on r.team_id = et.id and r.status in ('registered', 'waitlist')
   where et.id = NEW.team_id
     and r.id is not null;

  if v_active = 0 then
    return null;
  end if;
  if v_active <> 2 or v_statuses <> 1 or not v_has_captain then
    raise exception 'team_inconsistent'
      using errcode = 'P0001',
            detail = format('Team %s has %s active rows, %s statuses, captain present: %s.',
                            NEW.team_id, v_active, v_statuses, v_has_captain);
  end if;
  return null;
end
$function$;

create constraint trigger registrations_team_consistent
  after insert or update on public.registrations
  deferrable initially deferred
  for each row when (NEW.team_id is not null)
  execute function public.registrations_team_consistent();

create or replace function public.tournaments_guard_entry_mode()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if exists (
    select 1 from public.registrations r
     where r.tournament_id = NEW.id and r.status in ('registered', 'waitlist')
  ) then
    raise exception 'entry_mode_locked'
      using errcode = 'P0001',
            hint = 'Cancel every registration before switching between individual and team entry.';
  end if;
  return NEW;
end
$function$;

create trigger tournaments_guard_entry_mode
  before update of entry_mode on public.tournaments
  for each row when (OLD.entry_mode is distinct from NEW.entry_mode)
  execute function public.tournaments_guard_entry_mode();

-- ── 4. Partner creation (shared with leagues later, D-012) ─────────────────

create or replace function private.caller_is_admin()
returns boolean
language sql
stable
set search_path to 'pg_catalog'
as $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$function$;

-- The first non-admin path that creates a sign-in-able account for someone
-- else, so every bound lives here, not in the callers: consent recorded,
-- unused email, one account per call, 3 a day per person attesting.
create or replace function private.create_partner_player(
  input_requested_by uuid,
  input_tournament_id uuid,
  input_new_partner jsonb,
  input_consent boolean,
  input_skip_daily_cap boolean
)
returns table(status text, player_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(input_new_partner ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(input_new_partner ->> 'email', '')), ''));
  v_level_text text := nullif(btrim(coalesce(input_new_partner ->> 'playtomic_level', '')), '');
  v_level numeric := 0;
  v_id uuid;
begin
  if input_consent is not true then
    return query select 'consent_required'::text, null::uuid; return;
  end if;
  if v_name is null or length(v_name) > 100 then
    return query select 'invalid_name'::text, null::uuid; return;
  end if;
  if not private.is_valid_email(v_email) or v_email like '%@padelobsters.internal' then
    return query select 'invalid_email'::text, null::uuid; return;
  end if;
  if v_level_text is not null then
    if v_level_text !~ '^[0-9]+(\.[0-9]+)?$' or v_level_text::numeric > 7 then
      return query select 'invalid_level'::text, null::uuid; return;
    end if;
    v_level := v_level_text::numeric;
  end if;
  if exists (select 1 from public.players p where lower(p.email) = v_email)
     or exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return query select 'email_in_use'::text, null::uuid; return;
  end if;

  if not input_skip_daily_cap then
    perform pg_advisory_xact_lock(hashtextextended('partner_cap:' || input_requested_by::text, 0));
    if (select count(*) from public.partner_invites pi
         where pi.requested_by = input_requested_by
           and pi.created_at > now() - interval '24 hours') >= 3 then
      return query select 'partner_cap_reached'::text, null::uuid; return;
    end if;
  end if;

  begin
    insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
      playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
      preferred_position, tagline_label, pin, pin_hash)
    values (v_name, v_email, '', '', v_level, 0, v_level,
      '', '', 'active', false, '', '', null,
      '', '', null, null)
    returning id into v_id;
  exception when unique_violation then
    -- A concurrent signup took the email between the check and the insert.
    return query select 'email_in_use'::text, null::uuid; return;
  end;

  insert into public.partner_invites(player_id, tournament_id, requested_by, consent_confirmed_at)
  values (v_id, input_tournament_id, input_requested_by, now());

  return query select 'ok'::text, v_id;
end
$function$;

-- Validates the partner for a team: an existing active member not already in
-- the event, or a new account via create_partner_player.
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
  return query select 'ok'::text, input_partner_id;
end
$function$;

-- ── 5. Team RPCs ────────────────────────────────────────────────────────────
-- D-015: the captain is accepted on signup; the partner is pending until they
-- accept. While pending, the captain can swap the partner or cancel, and the
-- partner can accept or decline (declining cancels the team: complete teams
-- get the spots). Once both have accepted, nobody cancels; each player can
-- only transfer their own spot. Admins can do everything at any time.

-- Cancels a team's active rows and promotes the oldest waitlisted team into
-- the opening, if one opened. The caller holds the tournament lock.
create or replace function private.cancel_team_rows(input_team_id uuid, input_reason text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_team public.event_teams%rowtype;
  v_status text;
  v_max integer;
  v_count integer;
  v_promoted uuid;
begin
  select * into v_team from public.event_teams et where et.id = input_team_id;

  perform 1 from public.registrations r
   where r.team_id = input_team_id and r.status in ('registered', 'waitlist')
   for update;
  select max(r.status) into v_status
    from public.registrations r
   where r.team_id = input_team_id and r.status in ('registered', 'waitlist');

  update public.registrations r set status = 'cancelled'
   where r.team_id = input_team_id and r.status in ('registered', 'waitlist');
  update public.event_teams et
     set cancelled_at = now(), cancelled_reason = input_reason
   where et.id = input_team_id;

  if v_status is distinct from 'registered' then
    return null;
  end if;

  select t.max_players into v_max from public.tournaments t where t.id = v_team.tournament_id;
  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = v_team.tournament_id and r.status = 'registered';
  if v_count + 2 > v_max then
    return null;
  end if;

  select et.id into v_promoted
    from public.event_teams et
   where et.tournament_id = v_team.tournament_id
     and exists (select 1 from public.registrations r where r.team_id = et.id and r.status = 'waitlist')
   order by et.created_at, et.id
   limit 1;
  if v_promoted is not null then
    update public.registrations r set status = 'registered'
     where r.team_id = v_promoted and r.status = 'waitlist';
  end if;
  return v_promoted;
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

-- Reads the team and its pending/active partner row under the tournament lock.
-- Shared by the captain and partner actions below.
create or replace function private.lock_team(input_team_id uuid)
returns table(team public.event_teams, tournament public.tournaments, partner public.registrations)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_team public.event_teams%rowtype;
  v_t public.tournaments%rowtype;
  v_partner public.registrations%rowtype;
begin
  select * into v_team from public.event_teams et where et.id = input_team_id;
  if not found then
    return;
  end if;
  select * into v_t from public.tournaments t where t.id = v_team.tournament_id for update;
  -- Re-read under the lock: a captain transfer may have changed captain_id.
  select * into v_team from public.event_teams et where et.id = input_team_id;
  select * into v_partner
    from public.registrations r
   where r.team_id = input_team_id
     and r.player_id <> v_team.captain_id
     and r.status in ('registered', 'waitlist')
   for update;
  return query select v_team, v_t, v_partner;
end
$function$;

create or replace function public.change_team_partner(
  input_team_id uuid,
  input_partner_id uuid default null,
  input_new_partner jsonb default null,
  input_partner_consent boolean default false
)
returns table(status text, partner_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_lock record;
  v_partner record;
  v_admin boolean := private.caller_is_admin();
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'change_team_partner', true);

  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_lock from private.lock_team(input_team_id);
  if v_lock.team is null then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if (v_lock.team).captain_id is distinct from auth.uid() then
    perform public.require_admin();
  end if;
  if (v_lock.partner).id is null then
    return query select 'team_cancelled'::text, null::uuid; return;
  end if;
  if (v_lock.tournament).status = 'completed' then
    return query select 'tournament_completed'::text, null::uuid; return;
  end if;
  if not v_admin and (v_lock.partner).accepted_at is not null then
    return query select 'partner_accepted'::text, null::uuid; return;
  end if;
  if not v_admin and coalesce(public.tournament_transfers_closed((v_lock.tournament).id), true) then
    return query select 'change_closed'::text, null::uuid; return;
  end if;
  if input_partner_id = (v_lock.partner).player_id then
    return query select 'same_partner'::text, null::uuid; return;
  end if;

  select * into v_partner from private.resolve_team_partner(
    (v_lock.tournament).id, (v_lock.team).captain_id, input_partner_id, input_new_partner, input_partner_consent);
  if v_partner.status <> 'ok' then
    return query select v_partner.status, null::uuid; return;
  end if;

  update public.registrations r set status = 'cancelled' where r.id = (v_lock.partner).id;
  insert into public.registrations(tournament_id, player_id, status, payment_status, payment_method, team_id, accepted_at)
  values ((v_lock.tournament).id, v_partner.player_id, (v_lock.partner).status, 'covered', '', input_team_id, null);

  return query select 'changed'::text, v_partner.player_id;
end
$function$;

create or replace function public.cancel_my_team(input_team_id uuid)
returns table(status text, promoted_team_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_lock record;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'cancel_my_team', true);

  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_lock from private.lock_team(input_team_id);
  if v_lock.team is null or (v_lock.team).captain_id is distinct from auth.uid() then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if (v_lock.partner).id is null then
    return query select 'team_cancelled'::text, null::uuid; return;
  end if;
  if (v_lock.tournament).status = 'completed' then
    return query select 'tournament_completed'::text, null::uuid; return;
  end if;
  if (v_lock.partner).accepted_at is not null then
    return query select 'partner_accepted'::text, null::uuid; return;
  end if;
  if coalesce(public.tournament_transfers_closed((v_lock.tournament).id), true) then
    return query select 'cancel_closed'::text, null::uuid; return;
  end if;

  return query select 'cancelled'::text, private.cancel_team_rows(input_team_id, 'captain_cancelled');
end
$function$;

create or replace function public.respond_to_team_invite(input_team_id uuid, input_accept boolean)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_lock record;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'respond_to_team_invite', true);

  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_lock from private.lock_team(input_team_id);
  if v_lock.team is null or (v_lock.partner).player_id is distinct from auth.uid() then
    return query select 'not_found'::text; return;
  end if;
  if (v_lock.partner).accepted_at is not null then
    return query select 'not_pending'::text; return;
  end if;
  if exists (select 1 from public.partner_invites pi
              where pi.player_id = auth.uid() and pi.account_acknowledged_at is null) then
    return query select 'account_not_acknowledged'::text; return;
  end if;
  if (v_lock.tournament).status = 'completed'
     or coalesce(public.tournament_start_ts((v_lock.tournament).id) <= now(), false) then
    return query select 'tournament_started'::text; return;
  end if;

  if input_accept is true then
    update public.registrations r set accepted_at = now() where r.id = (v_lock.partner).id;
    return query select 'accepted'::text; return;
  end if;

  perform private.cancel_team_rows(input_team_id, 'partner_declined');
  return query select 'declined'::text;
end
$function$;

-- A captain-created account (D-021): who created it, for which event, and
-- whether the partner has confirmed it is theirs. No row for anyone else.
create or replace function public.get_my_account_setup()
returns table(requested_by_name text, tournament_name text, acknowledged boolean)
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
    select btrim(p.name), t.name, pi.account_acknowledged_at is not null
      from public.partner_invites pi
      join public.players p on p.id = pi.requested_by
      join public.tournaments t on t.id = pi.tournament_id
     where pi.player_id = auth.uid();
end
$function$;

create or replace function public.acknowledge_my_account()
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'acknowledge_my_account', true);
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.partner_invites pi
     set account_acknowledged_at = now()
   where pi.player_id = auth.uid()
     and pi.account_acknowledged_at is null;
  return query select case when found then 'ok' else 'not_needed' end;
end
$function$;

-- The signed-in player's team invites still waiting for an answer. A captain
-- learns of a decline from event_teams.cancelled_reason instead.
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
       and t.status <> 'completed'
     order by t.date, t.time;
end
$function$;

create or replace function public.admin_cancel_team(input_team_id uuid)
returns table(status text, promoted_team_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_lock record;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'admin_cancel_team', true);
  perform public.require_admin();

  select * into v_lock from private.lock_team(input_team_id);
  if v_lock.team is null then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if (v_lock.partner).id is null then
    return query select 'already_cancelled'::text, null::uuid; return;
  end if;

  return query select 'cancelled'::text, private.cancel_team_rows(input_team_id, 'admin_cancelled');
end
$function$;

create or replace function public.admin_promote_team(input_team_id uuid)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_lock record;
  v_count integer;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'admin_promote_team', true);
  perform public.require_admin();

  select * into v_lock from private.lock_team(input_team_id);
  if v_lock.team is null then
    return query select 'not_found'::text; return;
  end if;
  if (v_lock.partner).id is null then
    return query select 'not_waitlisted'::text; return;
  end if;
  if (v_lock.partner).status = 'registered' then
    return query select 'already_registered'::text; return;
  end if;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = (v_lock.tournament).id and r.status = 'registered';
  if v_count + 2 > (v_lock.tournament).max_players then
    return query select 'tournament_full'::text; return;
  end if;

  update public.registrations r set status = 'registered'
   where r.team_id = input_team_id and r.status = 'waitlist';
  return query select 'promoted'::text;
end
$function$;

-- D-016: the only way to change a payment status. Players move their own row
-- forward (unpaid → tikkied → pending_confirmation); admins set any status
-- except on a partner's 'covered' row, which only a transfer changes.
-- 20260807140000's body; a captain's reminder names the partner and the team
-- amount (D-005: the captain pays for both).
create or replace function public.get_payment_reminder_link(input_registration_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_player_id uuid;
  v_tournament_id uuid;
  v_team_id uuid;
  v_player_name text;
  v_phone text;
  v_tournament_name text;
  v_tikkie_link text;
  v_team_price numeric;
  v_partner_name text;
  v_digits text;
  v_message text;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();

  select r.player_id, r.tournament_id, r.team_id
    into v_player_id, v_tournament_id, v_team_id
    from public.registrations r
   where r.id = input_registration_id;

  if v_player_id is null then
    raise exception 'registration_not_found' using errcode = 'P0002';
  end if;

  select p.name, p.phone into v_player_name, v_phone
    from public.players p where p.id = v_player_id;

  select t.name, t.tikkie_link, 2 * t.total_price / nullif(t.max_players, 0)
    into v_tournament_name, v_tikkie_link, v_team_price
    from public.tournaments t where t.id = v_tournament_id;

  -- Audited unconditionally (the phone column was read either way), but
  -- `succeeded` records whether a usable link came out.
  if coalesce(v_tikkie_link, '') = '' then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return null;
  end if;

  v_digits := regexp_replace(coalesce(v_phone, ''), '[\s\-()]', '', 'g');
  if v_digits !~ '^\+\d{8,15}$' then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return null;
  end if;
  v_digits := regexp_replace(v_digits, '^\+', '');

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (v_player_id, 'payment_reminder', true);

  if v_team_id is not null then
    select p.name into v_partner_name
      from public.registrations r
      join public.players p on p.id = r.player_id
     where r.team_id = v_team_id
       and r.player_id <> v_player_id
       and r.status in ('registered', 'waitlist');
  end if;

  v_message := 'Hi ' || coalesce(nullif(v_player_name, ''), 'there')
    || '! Friendly reminder to pay for ' || coalesce(nullif(v_tournament_name, ''), 'the event');
  if v_team_id is not null then
    v_message := v_message || ' for your team (you and '
      || coalesce(nullif(split_part(trim(v_partner_name), ' ', 1), ''), 'your partner') || ')'
      || case when v_team_price > 0
              then ', €' || regexp_replace(to_char(v_team_price, 'FM999990.00'), '\.00$', '')
              else '' end;
  end if;
  v_message := v_message || ' via Tikkie: ' || v_tikkie_link || ' 🙏';

  return 'https://wa.me/' || v_digits || '?text=' || public._url_encode(v_message);
end;
$function$;

create or replace function public.set_registration_payment(
  input_registration_id uuid,
  input_payment_status text,
  input_payment_method text default ''
)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_reg public.registrations%rowtype;
  v_method text := left(coalesce(input_payment_method, ''), 40);
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'set_registration_payment', true);

  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_reg from public.registrations r where r.id = input_registration_id for update;
  if not found then
    return query select 'not_found'::text; return;
  end if;
  if v_reg.payment_status = 'covered' then
    return query select 'covered'::text; return;
  end if;
  if input_payment_status not in ('unpaid', 'tikkied', 'pending_confirmation', 'paid', 'transferred') then
    return query select 'invalid_status'::text; return;
  end if;

  if not private.caller_is_admin() then
    if v_reg.player_id is distinct from auth.uid() or v_reg.status not in ('registered', 'waitlist') then
      return query select 'forbidden'::text; return;
    end if;
    if not ((input_payment_status = 'tikkied' and v_reg.payment_status = 'unpaid')
            or (input_payment_status = 'pending_confirmation' and v_reg.payment_status in ('unpaid', 'tikkied'))) then
      return query select 'forbidden'::text; return;
    end if;
    v_method := 'tikkie';
  end if;

  update public.registrations r
     set payment_status = input_payment_status, payment_method = v_method
   where r.id = v_reg.id;
  return query select 'ok'::text;
end
$function$;

create or replace function public.admin_list_partner_invites(input_tournament_id uuid default null)
returns table(
  player_id uuid,
  tournament_id uuid,
  player_name text,
  email text,
  requested_by uuid,
  consent_confirmed_at timestamptz,
  created_at timestamptz,
  invited_at timestamptz,
  invited_by uuid,
  last_sign_in_at timestamptz,
  has_active_registration boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  perform public.require_admin();

  return query
    select pi.player_id, pi.tournament_id, p.name, p.email,
           pi.requested_by, pi.consent_confirmed_at, pi.created_at,
           pi.invited_at, pi.invited_by,
           u.last_sign_in_at,
           exists (
             select 1 from public.registrations r
              where r.player_id = pi.player_id
                and r.status in ('registered', 'waitlist')
                and (input_tournament_id is null or r.tournament_id = input_tournament_id)
           )
      from public.partner_invites pi
      join public.players p on p.id = pi.player_id
      left join auth.users u on u.id = pi.player_id
     where input_tournament_id is null or pi.tournament_id = input_tournament_id
     order by pi.created_at;
end
$function$;

-- ── 6. Guards on the individual RPCs ────────────────────────────────────────
-- Bodies as in 20260806211259 (register, cancel, promote), 20260923101407
-- (create_transfer) and 20260919123328 (apply_registration_transfer), plus the
-- team-event guard. A transfer or an individual cancel would split a team.

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

create or replace function public.cancel_registration(input_registration_id uuid)
returns table(status text, promoted_registration_id uuid, promoted_player_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_tournament_id uuid;
  v_team_id uuid;
  v_reg public.registrations%rowtype;
  v_max integer;
  v_count integer;
  v_freed_a_spot boolean;
  v_promoted public.registrations%rowtype;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'cancel_registration', true);
  perform public.require_admin();

  -- First read is only for the tournament id, so the locks can be taken in the
  -- house order: tournament, then registration. The status is deliberately read
  -- again below rather than trusted from here — two concurrent cancels of the
  -- same row would otherwise both see 'registered', both set v_freed_a_spot,
  -- and promote two waitlisters into one freed spot.
  select r.tournament_id, r.team_id into v_tournament_id, v_team_id
    from public.registrations r where r.id = input_registration_id;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid; return;
  end if;
  if v_team_id is not null then
    return query select 'use_cancel_team'::text, null::uuid, null::uuid; return;
  end if;

  select t.max_players into v_max
    from public.tournaments t where t.id = v_tournament_id
   for update;

  select * into v_reg from public.registrations r
   where r.id = input_registration_id
   for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid; return;
  end if;
  if v_reg.status = 'cancelled' then
    return query select 'already_cancelled'::text, null::uuid, null::uuid; return;
  end if;

  v_freed_a_spot := v_reg.status = 'registered';

  update public.registrations r set status = 'cancelled' where r.id = v_reg.id;

  if not v_freed_a_spot then
    return query select 'cancelled'::text, null::uuid, null::uuid; return;
  end if;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'registered';

  -- Only promote into an actual opening. On an event that is still over
  -- capacity — LOBS #10 is, at 26/24 — this promotes nobody, so the event
  -- converges back to its cap as people drop out instead of holding at 26.
  if v_count >= v_max then
    return query select 'cancelled'::text, null::uuid, null::uuid; return;
  end if;

  select * into v_promoted
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'waitlist'
   order by r.created_at, r.id
   limit 1;
  if not found then
    return query select 'cancelled'::text, null::uuid, null::uuid; return;
  end if;

  update public.registrations r set status = 'registered' where r.id = v_promoted.id;

  return query select 'cancelled'::text, v_promoted.id, v_promoted.player_id;
end
$function$;

create or replace function public.promote_waitlist_registration(input_registration_id uuid)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_reg public.registrations%rowtype;
  v_max integer;
  v_count integer;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'promote_waitlist_registration', true);
  perform public.require_admin();

  select * into v_reg from public.registrations r where r.id = input_registration_id;
  if not found then
    return query select 'not_found'::text; return;
  end if;
  if v_reg.team_id is not null then
    return query select 'use_promote_team'::text; return;
  end if;
  if v_reg.status = 'registered' then
    return query select 'already_registered'::text; return;
  end if;
  if v_reg.status <> 'waitlist' then
    return query select 'not_waitlisted'::text; return;
  end if;

  select t.max_players into v_max
    from public.tournaments t where t.id = v_reg.tournament_id
   for update;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'registered';

  if v_count >= v_max then
    return query select 'tournament_full'::text; return;
  end if;

  update public.registrations r set status = 'registered' where r.id = v_reg.id;
  return query select 'promoted'::text;
end
$function$;

create or replace function public.create_transfer(
  input_to_player_id uuid,
  input_tournament_id uuid,
  input_from_player_id uuid default null
)
 returns table(transfer_id uuid, status text)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_caller_id uuid;
  v_from_player_id uuid;
  v_target_status text;
  v_existing_pending uuid;
  v_closed boolean;
  v_new_id uuid;
begin
  set local statement_timeout = '30s';
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_from_player_id := coalesce(input_from_player_id, v_caller_id);

  -- Acting on someone else's registration requires admin. This is the
  -- server-side gate; the client is never trusted to decide it may transfer
  -- another player's spot just because it asked to.
  if v_from_player_id is distinct from v_caller_id then
    perform public.require_admin();
  end if;

  if input_to_player_id is null or input_to_player_id = v_from_player_id then
    return query select null::uuid, 'invalid_target'::text; return;
  end if;
  if not exists (
    select 1 from public.players p
     where p.id = input_to_player_id and coalesce(p.status, 'active') = 'active'
  ) then
    return query select null::uuid, 'invalid_target'::text; return;
  end if;
  if not exists (
    select 1 from public.registrations r
     where r.tournament_id = input_tournament_id
       and r.player_id = v_from_player_id
       and r.status = 'registered'
  ) then
    return query select null::uuid, 'not_registered'::text; return;
  end if;
  -- D-015: a team spot moves only once both players have accepted, and only to
  -- someone who isn't already in the event (a waitlisted player is on a team).
  if exists (
    select 1 from public.tournaments t where t.id = input_tournament_id and t.entry_mode = 'team'
  ) then
    if private.team_spot_transferable(input_tournament_id, v_from_player_id) is not true then
      return query select null::uuid, 'team_not_confirmed'::text; return;
    end if;
    if exists (
      select 1 from public.registrations r
       where r.tournament_id = input_tournament_id
         and r.player_id = input_to_player_id
         and r.status in ('registered', 'waitlist')
    ) then
      return query select null::uuid, 'target_already_registered'::text; return;
    end if;
  end if;
  select r.status into v_target_status
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.player_id = input_to_player_id
     and r.status = 'registered'
   limit 1;
  if v_target_status = 'registered' then
    return query select null::uuid, 'target_already_registered'::text; return;
  end if;
  v_closed := public.tournament_transfers_closed(input_tournament_id);
  if coalesce(v_closed, true) then
    return query select null::uuid, 'transfers_closed'::text; return;
  end if;
  select rt.id into v_existing_pending
    from public.registration_transfers rt
   where rt.tournament_id = input_tournament_id
     and rt.from_player_id = v_from_player_id
     and rt.status = 'pending'
   limit 1;
  if v_existing_pending is not null then
    return query select v_existing_pending, 'already_pending'::text; return;
  end if;
  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (input_tournament_id, v_from_player_id, input_to_player_id)
  returning id into v_new_id;
  return query select v_new_id, 'ok'::text;
end
$function$;

-- 20260923101407's body, except a decline only drops an individual waitlist
-- row: cancelling one row of a waitlisted team would break the pair.
create or replace function public.respond_to_transfer(input_transfer_id uuid, input_accept boolean)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_to_player_id uuid;
  v_xfer public.registration_transfers%rowtype;
  v_closed boolean;
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

    -- Qualified columns: bare `status` is ambiguous with the output column (42702).
    update public.registrations r
       set status = 'cancelled'
     where r.tournament_id = v_xfer.tournament_id
       and r.player_id = v_to_player_id
       and r.status = 'waitlist'
       and r.team_id is null;

    return query select 'declined'::text; return;
  end if;

  v_closed := public.tournament_transfers_closed(v_xfer.tournament_id);
  if coalesce(v_closed, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'transfers_closed', closed_at = now()
     where id = v_xfer.id;
    return query select 'transfers_closed'::text; return;
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

-- True when the player's registered team row may be transferred: both team
-- members have accepted (D-015).
create or replace function private.team_spot_transferable(input_tournament_id uuid, input_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1 from public.registrations mine
     where mine.tournament_id = input_tournament_id
       and mine.player_id = input_player_id
       and mine.status = 'registered'
       and mine.team_id is not null
       and mine.accepted_at is not null
       and not exists (
         select 1 from public.registrations r
          where r.team_id = mine.team_id
            and r.status in ('registered', 'waitlist')
            and r.accepted_at is null
       )
  )
$function$;

-- The team half of apply_registration_transfer. The recipient takes the
-- leaver's place on the team, accepted (they accepted the transfer). A captain
-- hands over the captaincy and the team payment; a partner's place stays
-- covered by the captain.
create or replace function private.apply_team_transfer(
  input_xfer public.registration_transfers,
  input_from_reg_id uuid,
  input_team_id uuid,
  input_captain_payment_status text
)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_is_captain boolean;
begin
  if private.team_spot_transferable(input_xfer.tournament_id, input_xfer.from_player_id) is not true then
    return 'team_not_confirmed';
  end if;
  if exists (
    select 1 from public.registrations r
     where r.tournament_id = input_xfer.tournament_id
       and r.player_id = input_xfer.to_player_id
       and r.status in ('registered', 'waitlist')
  ) then
    return 'to_already_registered';
  end if;

  v_is_captain := exists (
    select 1 from public.event_teams et
     where et.id = input_team_id and et.captain_id = input_xfer.from_player_id
  );

  update public.registrations r
     set status = 'cancelled',
         payment_method = 'transferred_to:' || input_xfer.to_player_id::text
   where r.id = input_from_reg_id;

  insert into public.registrations(tournament_id, player_id, status, payment_status, payment_method, team_id, accepted_at)
  values (
    input_xfer.tournament_id,
    input_xfer.to_player_id,
    'registered',
    case when v_is_captain then input_captain_payment_status else 'covered' end,
    'transferred_from:' || input_xfer.from_player_id::text,
    input_team_id,
    now()
  );

  if v_is_captain then
    update public.event_teams et set captain_id = input_xfer.to_player_id where et.id = input_team_id;
  end if;
  return 'accepted';
end
$function$;

create or replace function public.apply_registration_transfer(input_transfer_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_xfer public.registration_transfers%rowtype;
  v_entry_mode text;
  v_team_id uuid;
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

  select t.entry_mode into v_entry_mode from public.tournaments t where t.id = v_xfer.tournament_id for update;

  select r.id, r.payment_status, r.team_id into v_from_reg_id, v_from_payment_status, v_team_id
    from public.registrations r
   where r.tournament_id = v_xfer.tournament_id
     and r.player_id = v_xfer.from_player_id
     and r.status = 'registered'
   for update;

  if v_from_reg_id is null then
    return 'from_not_registered';
  end if;

  v_new_payment_status := case when v_from_payment_status = 'paid' then 'paid' else 'unpaid' end;

  if v_entry_mode = 'team' then
    return private.apply_team_transfer(v_xfer, v_from_reg_id, v_team_id, v_new_payment_status);
  end if;

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

  -- Schedule state is separate from registration state: a match generated
  -- before this transfer was accepted still points at from_player_id. Keep
  -- it truthful, or Finish Tournament's rating fold-in breaks on a player id
  -- that no longer has a 'registered' row. array_replace is a no-op on rows
  -- where the id isn't present.
  update public.matches m
     set team1_ids = array_replace(m.team1_ids, v_xfer.from_player_id, v_xfer.to_player_id),
         team2_ids = array_replace(m.team2_ids, v_xfer.from_player_id, v_xfer.to_player_id)
   where m.tournament_id = v_xfer.tournament_id
     and (v_xfer.from_player_id = any(m.team1_ids) or v_xfer.from_player_id = any(m.team2_ids));

  return 'accepted';
end
$function$;

-- ── 7. Grants ───────────────────────────────────────────────────────────────
-- Deny-all baseline (20260727194010). CREATE OR REPLACE kept the existing
-- grants on the guarded individual-event functions.

revoke execute on function public.registrations_guard_team_rows() from public, anon, authenticated;
revoke execute on function public.registrations_team_consistent() from public, anon, authenticated;
revoke execute on function public.tournaments_guard_entry_mode() from public, anon, authenticated;
revoke execute on function private.team_spot_transferable(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.caller_is_admin() from public, anon, authenticated;
revoke execute on function private.create_partner_player(uuid, uuid, jsonb, boolean, boolean) from public, anon, authenticated;
revoke execute on function private.resolve_team_partner(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke execute on function private.cancel_team_rows(uuid, text) from public, anon, authenticated;
revoke execute on function private.lock_team(uuid) from public, anon, authenticated;
revoke execute on function private.apply_team_transfer(public.registration_transfers, uuid, uuid, text) from public, anon, authenticated;

revoke execute on function public.register_team_for_tournament(uuid, uuid, uuid, jsonb, boolean) from public, anon;
revoke execute on function public.change_team_partner(uuid, uuid, jsonb, boolean) from public, anon;
revoke execute on function public.cancel_my_team(uuid) from public, anon;
revoke execute on function public.respond_to_team_invite(uuid, boolean) from public, anon;
revoke execute on function public.get_my_team_invites() from public, anon;
revoke execute on function public.get_my_account_setup() from public, anon;
revoke execute on function public.acknowledge_my_account() from public, anon;
revoke execute on function public.admin_cancel_team(uuid) from public, anon;
revoke execute on function public.admin_promote_team(uuid) from public, anon;
revoke execute on function public.set_registration_payment(uuid, text, text) from public, anon;
revoke execute on function public.admin_list_partner_invites(uuid) from public, anon;

grant execute on function public.register_team_for_tournament(uuid, uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.change_team_partner(uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.cancel_my_team(uuid) to authenticated;
grant execute on function public.respond_to_team_invite(uuid, boolean) to authenticated;
grant execute on function public.get_my_team_invites() to authenticated;
grant execute on function public.get_my_account_setup() to authenticated;
grant execute on function public.acknowledge_my_account() to authenticated;
grant execute on function public.admin_cancel_team(uuid) to authenticated;
grant execute on function public.admin_promote_team(uuid) to authenticated;
grant execute on function public.set_registration_payment(uuid, text, text) to authenticated;
grant execute on function public.admin_list_partner_invites(uuid) to authenticated;
