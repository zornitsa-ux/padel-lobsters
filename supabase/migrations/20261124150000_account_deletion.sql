-- ============================================================================
-- Account deletion AD2: deletion in the database (docs/account-deletion/,
-- DESIGN §2, CONTRACTS C-1 to C-6).
--
-- A member (delete_my_account) or an admin (admin_delete_account) deletes an
-- account after a fresh email-code sign-in. The players row stays, so results
-- keep their ids; it gets an anonymised, reserved name and loses everything
-- personal, the auth user is deleted, upcoming individual spots are cancelled
-- and team-event spots stay with the partner. Triggers stop anything from
-- linking to, or writing into, a deleted player afterwards.
--
-- Replaces the old soft delete (admin_delete_player) and the service-role
-- hard delete (admin_purge_player); production has no deleted players.
-- ============================================================================

-- ── 1. Anonymised and reserved names (C-1) ─────────────────────────────────

create sequence private.deleted_player_number as bigint start 1;

create function private.anonymised_name(input_number bigint)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select 'Anonymous '
      || (array['Octopus', 'Seahorse', 'Dolphin', 'Turtle', 'Starfish', 'Jellyfish',
                'Crab', 'Narwhal', 'Pufferfish', 'Orca', 'Seal', 'Squid'])[(input_number - 1) % 12 + 1]
      || ' #' || input_number
$function$;

-- Strict: tells a deleted account apart (the client's isAnonymisedName).
create function private.is_anonymised_name(input_name text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select coalesce(regexp_replace(input_name, '^\s+|\s+$', '', 'g') ~ '^Anonymous [A-Z][a-z]+ #[0-9]+$', false)
$function$;

-- Loose: refused as anyone's name, so lookalikes can't pass for a deleted account.
create function private.is_reserved_name(input_name text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select coalesce(lower(regexp_replace(btrim(input_name), '\s+', ' ', 'g')) ~ '^anonymous [a-z]+ #[0-9]+$', false)
$function$;

revoke all on function private.anonymised_name(bigint) from public, anon, authenticated;
revoke all on function private.is_anonymised_name(text) from public, anon, authenticated;
revoke all on function private.is_reserved_name(text) from public, anon, authenticated;

-- Every path that names a player goes through this, so the eight writers
-- (signup, profile, admin edits, partners, league placeholders) need no
-- change of their own. Only the deletion sets app.deleting_player.
create function private.players_reserved_name()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
begin
  if tg_op = 'UPDATE' and new.name is not distinct from old.name then
    return new;
  end if;
  if private.is_reserved_name(new.name)
     and coalesce(current_setting('app.deleting_player', true), '') <> new.id::text then
    raise exception 'reserved_name' using errcode = 'P0001';
  end if;
  return new;
end
$function$;
revoke all on function private.players_reserved_name() from public, anon, authenticated;

create trigger players_reserved_name
  before insert or update of name on public.players
  for each row execute function private.players_reserved_name();

-- The signup hook says so in words rather than failing at confirmation.
create or replace function public.before_user_created_hook(event jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_meta   jsonb := coalesce(event -> 'user' -> 'user_metadata', '{}'::jsonb);
  v_name   text  := nullif(regexp_replace(btrim(coalesce(v_meta ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_source text  := nullif(btrim(coalesce(v_meta ->> 'signup_source', '')), '');
  v_detail text  := btrim(coalesce(v_meta ->> 'signup_source_detail', ''));
begin
  if v_name is null then
    return private.signup_rejection(input_message => 'Please enter your name.');
  end if;
  if length(v_name) > 100 then
    return private.signup_rejection(input_message => 'Your name can be at most 100 characters.');
  end if;
  if private.is_reserved_name(v_name) then
    return private.signup_rejection(input_message => 'Please enter your own name.');
  end if;
  begin
    perform private.level_to_store(v_meta ->> 'playtomic_level', 'optional');
  exception when raise_exception then
    return private.signup_rejection(input_message =>
      'Playtomic level must be a number above 0 and up to 7, with at most 2 decimals, e.g. 2.45.');
  end;
  if v_source is not null and v_source not in ('lobster', 'instagram', 'plaza_whatsapp', 'other') then
    return private.signup_rejection(input_message => 'Please pick how you found us from the list.');
  end if;
  -- A detail sent with instagram/plaza_whatsapp is dropped by the trigger, not rejected.
  if v_source in ('lobster', 'other') and length(v_detail) > 100 then
    return private.signup_rejection(input_message => 'How you found us can be at most 100 characters.');
  end if;
  if exists (
    select 1 from public.players p
     where p.status = 'placeholder'
       and lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = lower(v_name)
  ) then
    return private.signup_rejection(
      input_message => 'You’ve already been added to a Lobster team — ask an admin to invite you.');
  end if;
  return '{}'::jsonb;
end;
$function$;

-- A captain's new partner: a reserved name is an invalid name, as a status.
create or replace function private.create_partner_player(input_requested_by uuid, input_tournament_id uuid, input_new_partner jsonb, input_consent boolean, input_skip_daily_cap boolean)
 returns table(status text, player_id uuid)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(input_new_partner ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(input_new_partner ->> 'email', '')), ''));
  v_level numeric;
  v_email_problem text;
  v_id uuid;
begin
  if input_consent is not true then
    return query select 'consent_required'::text, null::uuid; return;
  end if;
  if v_name is null or length(v_name) > 100 or private.is_reserved_name(v_name) then
    return query select 'invalid_name'::text, null::uuid; return;
  end if;
  v_email_problem := private.new_partner_email_problem(v_email);
  if v_email_problem = 'invalid_email' then
    return query select 'invalid_email'::text, null::uuid; return;
  end if;
  begin
    v_level := private.level_to_store(input_new_partner ->> 'playtomic_level', 'required');
  exception when raise_exception then
    return query select 'invalid_level'::text, null::uuid; return;
  end;
  if v_email_problem = 'email_in_use' then
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
    insert into public.players(name, email, phone, notes, playtomic_level,
      playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
      preferred_position, tagline_label)
    values (v_name, v_email, '', '', v_level,
      '', '', 'active', false, '', '', null,
      '', '')
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

-- ── 2. A deleted player stays deleted (C-6, DESIGN §2.5) ───────────────────

-- Public: the avatar storage policies call it, and browser roles have no
-- usage on the private schema. It reveals only what players_public shows.
create function public.is_deleted_player(input_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (select 1 from public.players p where p.id = input_id and p.status = 'deleted')
$function$;
revoke all on function public.is_deleted_player(uuid) from public, anon, authenticated;
grant execute on function public.is_deleted_player(uuid) to authenticated;

-- Frozen once deleted, except the rating columns: ratings for an event the
-- player played in are still applied and reviewed.
create function private.players_frozen_when_deleted()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if old.status = 'deleted'
     and to_jsonb(new) - array['mm_rating', 'mm_sigma', 'mm_rating_updated_at']
         is distinct from to_jsonb(old) - array['mm_rating', 'mm_sigma', 'mm_rating_updated_at'] then
    raise exception 'player_deleted' using errcode = 'P0001';
  end if;
  return new;
end
$function$;
revoke all on function private.players_frozen_when_deleted() from public, anon, authenticated;

create trigger players_frozen_when_deleted
  before update on public.players
  for each row execute function private.players_frozen_when_deleted();

-- No new link to a deleted player. TG_ARGV names the player columns. Rows
-- that already point at one pass, unless they come back to life (a cancelled
-- registration re-entered, a closed transfer re-opened). Waitlist promotion
-- is not coming back, so a team with a deleted member can still be promoted.
create function private.refuse_link_to_deleted_player()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_col text;
  v_new text;
  v_revived boolean := false;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'registrations' then
      v_revived := old.status = 'cancelled' and new.status in ('registered', 'waitlist');
    elsif tg_table_name = 'registration_transfers' then
      v_revived := old.status <> 'pending' and new.status = 'pending';
    end if;
  end if;
  foreach v_col in array tg_argv loop
    v_new := to_jsonb(new) ->> v_col;
    continue when v_new is null
      or v_new !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    continue when tg_op = 'UPDATE' and not v_revived
      and v_new is not distinct from to_jsonb(old) ->> v_col;
    if public.is_deleted_player(v_new::uuid) then
      raise exception 'player_deleted' using errcode = 'P0001',
        detail = format('%s.%s', tg_table_name, v_col);
    end if;
  end loop;
  return new;
end
$function$;
revoke all on function private.refuse_link_to_deleted_player() from public, anon, authenticated;

create trigger registrations_no_deleted_player
  before insert or update on public.registrations
  for each row execute function private.refuse_link_to_deleted_player('player_id');
create trigger registration_transfers_no_deleted_player
  before insert or update on public.registration_transfers
  for each row execute function private.refuse_link_to_deleted_player('from_player_id', 'to_player_id');
create trigger partner_invites_no_deleted_player
  before insert or update on public.partner_invites
  for each row execute function private.refuse_link_to_deleted_player('player_id');
create trigger event_teams_no_deleted_player
  before insert or update on public.event_teams
  for each row execute function private.refuse_link_to_deleted_player('captain_id');
create trigger league_teams_no_deleted_player
  before insert or update on public.league_teams
  for each row execute function private.refuse_link_to_deleted_player('player1_id', 'player2_id');
create trigger raffle_winners_no_deleted_player
  before insert or update on public.raffle_winners
  for each row execute function private.refuse_link_to_deleted_player('player_id');
create trigger raffle_exclusions_no_deleted_player
  before insert or update on public.raffle_exclusions
  for each row execute function private.refuse_link_to_deleted_player('player_id');
create trigger lobster_oscars_votes_no_deleted_player
  before insert or update on public.lobster_oscars_votes
  for each row execute function private.refuse_link_to_deleted_player('voter_id', 'target_id');
create trigger league_interests_no_deleted_player
  before insert or update on public.league_interests
  for each row execute function private.refuse_link_to_deleted_player('player_id');
create trigger player_aliases_no_deleted_player
  before insert or update on public.player_aliases
  for each row execute function private.refuse_link_to_deleted_player('player_id');
create trigger merch_interests_no_deleted_player
  before insert or update on public.merch_interests
  for each row execute function private.refuse_link_to_deleted_player('player_id');

-- Matches hold players in id arrays. An id new to the row must not be
-- deleted; ids already there pass, so scores can still be entered.
create function private.matches_no_deleted_player()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if exists (
    select 1
      from unnest(coalesce(new.team1_ids, '{}') || coalesce(new.team2_ids, '{}')) as n(id)
     where public.is_deleted_player(n.id)
       and (tg_op = 'INSERT'
            or not n.id = any(coalesce(old.team1_ids, '{}') || coalesce(old.team2_ids, '{}')))
  ) then
    raise exception 'player_deleted' using errcode = 'P0001', detail = 'matches';
  end if;
  return new;
end
$function$;
revoke all on function private.matches_no_deleted_player() from public, anon, authenticated;

create trigger matches_no_deleted_player
  before insert or update of team1_ids, team2_ids on public.matches
  for each row execute function private.matches_no_deleted_player();

-- ── 3. Avatars (C-5) ───────────────────────────────────────────────────────

drop policy if exists "Player or admin upload avatar" on storage.objects;
drop policy if exists "Player or admin update avatar" on storage.objects;

create policy "Player or admin upload avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and not public.is_deleted_player(auth.uid())
    and (
      name = 'player-' || auth.uid()::text || '.webp'
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

create policy "Player or admin update avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and not public.is_deleted_player(auth.uid())
    and (
      name = 'player-' || auth.uid()::text || '.webp'
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

create policy "Player or admin delete avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      name = 'player-' || auth.uid()::text || '.webp'
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

-- ── 4. Shared steps ────────────────────────────────────────────────────────

-- cancel_registration's body, without the admin check, so the deletion
-- cancels a member's spot exactly as an admin would (waitlist moves up).
create function private.cancel_registration_row(input_registration_id uuid)
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
  -- capacity this promotes nobody, so the event converges back to its cap as
  -- people drop out instead of holding above it.
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
revoke all on function private.cancel_registration_row(uuid) from public, anon, authenticated;

create or replace function public.cancel_registration(input_registration_id uuid)
 returns table(status text, promoted_registration_id uuid, promoted_player_id uuid)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'cancel_registration', true);
  perform public.require_admin();
  return query select * from private.cancel_registration_row(input_registration_id);
end
$function$;

-- A captain may replace a partner who has deleted their account, even one
-- who had accepted (D-3); otherwise as in 20261022120000_team_events.sql.
create or replace function public.change_team_partner(input_team_id uuid, input_partner_id uuid default null::uuid, input_new_partner jsonb default null::jsonb, input_partner_consent boolean default false)
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
  if not v_admin and (v_lock.partner).accepted_at is not null
     and not public.is_deleted_player((v_lock.partner).player_id) then
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

-- A fresh email-code sign-in in the last 10 minutes (D-11): the token's amr
-- holds an otp entry with its time.
create function private.has_recent_email_code()
returns boolean
language sql
stable
set search_path to 'pg_catalog'
as $function$
  select exists (
    select 1
      from jsonb_array_elements(
             case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
           ) e
     where e ->> 'method' = 'otp'
       and (e ->> 'timestamp') ~ '^[0-9]+$'
       and (e ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 600
  )
$function$;
revoke all on function private.has_recent_email_code() from public, anon, authenticated;

-- An event dated today or earlier that isn't completed: its schedule,
-- results and ratings are still being written.
create function private.in_live_event(input_player_id uuid)
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
       and t.status <> 'completed'
       and t.date <= (now() at time zone 'Europe/Amsterdam')::date
  )
$function$;
revoke all on function private.in_live_event(uuid) from public, anon, authenticated;

-- ── 5. Follow-ups for admins (C-3, DESIGN §3.4) ────────────────────────────

create table public.account_deletion_followups (
  id bigint generated always as identity primary key,
  player_id uuid not null,
  ref_table text not null
    check (ref_table in ('league_teams', 'merch_interests', 'players', 'tournaments')),
  ref_id text not null,
  ref_column text not null
    check (ref_column in ('team_name', 'team_song', 'spirit_animal', 'admin_comment', 'notes')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  dismissed_by uuid
);
alter table public.account_deletion_followups enable row level security;
revoke all on public.account_deletion_followups from anon, authenticated;

create function private.regex_escape(input_text text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select regexp_replace(input_text, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
$function$;
revoke all on function private.regex_escape(text) from public, anon, authenticated;

-- Where the name may sit in free text: the full name, or the first name
-- when it's 3 letters or more, as a whole word, any case. Only where it is
-- is stored, never the name.
create function private.record_deletion_followups(input_player_id uuid, input_name text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_full text := regexp_replace(btrim(coalesce(input_name, '')), '\s+', ' ', 'g');
  v_first text := split_part(v_full, ' ', 1);
  v_pattern text;
begin
  if v_full = '' then
    return;
  end if;
  v_pattern := '\m(' || private.regex_escape(v_full)
    || case when length(v_first) >= 3 and v_first <> v_full then '|' || private.regex_escape(v_first) else '' end
    || ')\M';

  insert into public.account_deletion_followups(player_id, ref_table, ref_id, ref_column)
  select input_player_id, 'league_teams', lt.id::text, c.col
    from public.league_teams lt
   cross join lateral (values ('team_name', lt.team_name), ('team_song', lt.team_song),
                              ('spirit_animal', lt.spirit_animal)) c(col, val)
   where c.val ~* v_pattern
  union all
  select input_player_id, 'merch_interests', mi.id::text, 'admin_comment'
    from public.merch_interests mi
   where mi.admin_comment ~* v_pattern
  union all
  select input_player_id, 'players', p.id::text, 'notes'
    from public.players p
   where p.id <> input_player_id and p.status <> 'deleted' and p.notes ~* v_pattern
  union all
  select input_player_id, 'tournaments', t.id::text, 'notes'
    from public.tournaments t
   where t.notes ~* v_pattern;
end
$function$;
revoke all on function private.record_deletion_followups(uuid, text) from public, anon, authenticated;

-- context_id is the screen the row is edited on: the league, the event, the
-- shop item or the player.
create function public.admin_list_deletion_followups()
returns table(kind text, ref_table text, ref_id text, ref_column text, player_name text,
              followup_id bigint, context_id text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
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
   order by 1, 5, 3;
end
$function$;
revoke all on function public.admin_list_deletion_followups() from public, anon, authenticated;
grant execute on function public.admin_list_deletion_followups() to authenticated;

create function public.admin_dismiss_deletion_followup(input_followup_id bigint)
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  update public.account_deletion_followups f
     set dismissed_at = now(), dismissed_by = auth.uid()
   where f.id = input_followup_id and f.dismissed_at is null;
  if found then
    return query select 'dismissed'::text;
  else
    return query select 'not_found'::text;
  end if;
end
$function$;
revoke all on function public.admin_dismiss_deletion_followup(bigint) from public, anon, authenticated;
grant execute on function public.admin_dismiss_deletion_followup(bigint) to authenticated;

-- ── 6. What deletion will do, for the confirmation screen (C-2) ────────────

create function private.deletion_summary(input_player_id uuid)
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
       and t.status <> 'completed'
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

create function public.get_my_deletion_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return private.deletion_summary(auth.uid());
end
$function$;
revoke all on function public.get_my_deletion_summary() from public, anon, authenticated;
grant execute on function public.get_my_deletion_summary() to authenticated;

create function public.admin_get_deletion_summary(input_target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.require_admin();
  return private.deletion_summary(input_target_id);
end
$function$;
revoke all on function public.admin_get_deletion_summary(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_deletion_summary(uuid) to authenticated;

-- ── 7. The deletion (DESIGN §2.3) ───────────────────────────────────────────

-- Returns the anonymised name, or null if the player was already deleted.
-- Callers check who may delete whom before calling.
create function private.delete_account(input_target_id uuid, input_by_admin boolean)
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
       and t.status <> 'completed'
     order by t.id
  loop
    perform private.cancel_registration_row(v_row.id);
  end loop;

  -- 3. Team spots stay with the pair (D-3): the partner becomes captain, or
  -- the team is cancelled when the partner is deleted too.
  for v_row in
    select r.team_id
      from public.registrations r
      join public.tournaments t on t.id = r.tournament_id
     where r.player_id = input_target_id
       and r.team_id is not null
       and r.status in ('registered', 'waitlist')
       and t.status <> 'completed'
     order by t.id
  loop
    perform private.lock_team(v_row.team_id);
    select r.player_id into v_other
      from public.registrations r
     where r.team_id = v_row.team_id
       and r.status in ('registered', 'waitlist')
       and r.player_id <> input_target_id;
    if v_other is null or public.is_deleted_player(v_other) then
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

alter table public.event_teams drop constraint event_teams_cancelled_reason_check;
alter table public.event_teams add constraint event_teams_cancelled_reason_check
  check (cancelled_reason = any (array['partner_declined', 'captain_cancelled', 'admin_cancelled',
    'account_deleted']));

alter table public.security_events drop constraint security_events_attempt_kind_check;
alter table public.security_events add constraint security_events_attempt_kind_check
  check (attempt_kind = any (array['player', 'admin', 'pii_dump', 'approve_device', 'admin_unlock',
    'admin_action', 'signup', 'pin_reset', 'payment_reminder', 'player_pii_read',
    'account_deleted_self', 'account_deleted_admin']));

create function public.delete_my_account()
returns table(status text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_player public.players%rowtype;
begin
  set local statement_timeout = '30s';
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_player from public.players p where p.id = auth.uid();
  if not found then
    return query select 'not_found'::text; return;
  end if;
  if v_player.status = 'deleted' then
    return query select 'already_deleted'::text; return;
  end if;
  if v_player.role = 'admin' or private.caller_is_admin() then
    return query select 'admin_must_step_down'::text; return;
  end if;
  if private.in_live_event(v_player.id) then
    return query select 'in_live_event'::text; return;
  end if;
  if not private.has_recent_email_code() then
    return query select 'code_required'::text; return;
  end if;
  if private.delete_account(v_player.id, false) is null then
    return query select 'already_deleted'::text; return;
  end if;
  return query select 'deleted'::text;
end
$function$;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

create function public.admin_delete_account(input_target_id uuid)
returns table(status text, anonymised_name text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_name text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  select * into v_player from public.players p where p.id = input_target_id;
  if not found then
    return query select 'not_found'::text, null::text; return;
  end if;
  if v_player.id = auth.uid() then
    return query select 'cannot_delete_self'::text, null::text; return;
  end if;
  if v_player.status = 'deleted' then
    return query select 'already_deleted'::text, null::text; return;
  end if;
  if v_player.role = 'admin' then
    return query select 'admin_must_step_down'::text, null::text; return;
  end if;
  if private.in_live_event(v_player.id) then
    return query select 'in_live_event'::text, null::text; return;
  end if;
  if not private.has_recent_email_code() then
    return query select 'code_required'::text, null::text; return;
  end if;
  v_name := private.delete_account(v_player.id, true);
  if v_name is null then
    return query select 'already_deleted'::text, null::text; return;
  end if;
  return query select 'deleted'::text, v_name;
end
$function$;
revoke all on function public.admin_delete_account(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_account(uuid) to authenticated;

-- ── 8. One path for every removal (D-7) ─────────────────────────────────────

drop function public.admin_delete_player(uuid);
drop function public.admin_purge_player(uuid);
