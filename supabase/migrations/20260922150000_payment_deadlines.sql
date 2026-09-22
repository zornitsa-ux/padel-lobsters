-- ============================================================================
-- Payment deadlines: an unpaid player who ignores a payment reminder loses
-- their spot, and a spot that opens in a full event is announced to everyone.
--
--   1. The admin taps Remind, picks a number of hours (48 by default) and the
--      WhatsApp message carries the resulting deadline. Tapping Send records it
--      in payment_deadlines.
--   2. An hourly job cancels registrations whose deadline has passed and that
--      are still 'unpaid'. 'tikkied' / 'pending_confirmation' at the deadline
--      counts as having paid in time: the player said they paid, so it is the
--      admin's call, not the job's.
--   3. Cancelling a registered player no longer promotes the oldest waitlister.
--      The spot is simply released. If the event was full before the cancel,
--      every active Lobster who is not registered — waitlisters included — is
--      emailed, and the first to sign up gets it. register_for_tournament now
--      lets a waitlisted player take an open spot ("Grab the spot").
--
-- Emails are sent by the send-spot-released edge function via pg_net. The
-- request is only dispatched after the transaction commits (pg_net's queue is
-- an ordinary table), so a rolled-back cancel never emails anyone. There is no
-- retry: a retry is what caused the LOBStournament #8 double-send, and a
-- missed "spot open" email is cheaper than a duplicate one.
-- ============================================================================

-- ── payment_deadlines ───────────────────────────────────────────────────────
create table if not exists public.payment_deadlines (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  player_id       uuid not null,
  deadline_at     timestamptz not null,
  status          text not null default 'active',
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  closed_at       timestamptz,
  constraint payment_deadlines_status_check
    check (status in ('active', 'superseded', 'resolved', 'expired'))
);

comment on table public.payment_deadlines is
  'Pay-by deadlines set by the admin Remind button. active → resolved (paid, claimed paid, transferred or cancelled), superseded (a newer reminder), or expired (spot released by expire_payment_deadlines).';

create unique index if not exists payment_deadlines_one_active_per_registration
  on public.payment_deadlines (registration_id) where status = 'active';
create index if not exists payment_deadlines_due_idx
  on public.payment_deadlines (deadline_at) where status = 'active';
create index if not exists payment_deadlines_tournament_idx
  on public.payment_deadlines (tournament_id);

alter table public.payment_deadlines enable row level security;

drop policy if exists payment_deadlines_admin_read on public.payment_deadlines;
create policy payment_deadlines_admin_read
  on public.payment_deadlines
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.payment_deadlines to authenticated;

-- ── spot_released_emails ────────────────────────────────────────────────────
-- One row per dispatch, so "did the waitlist hear about the spot?" has an
-- answer. The delivery outcome is in net._http_response under net_request_id.
create table if not exists public.spot_released_emails (
  id              bigint generated always as identity primary key,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  trigger_source  text not null,
  spots           integer not null,
  recipient_count integer not null,
  released_player_ids uuid[] not null default '{}',
  net_request_id  bigint,
  created_at      timestamptz not null default now(),
  constraint spot_released_emails_source_check
    check (trigger_source in ('payment_deadline', 'admin_cancel'))
);

alter table public.spot_released_emails enable row level security;

drop policy if exists spot_released_emails_admin_read on public.spot_released_emails;
create policy spot_released_emails_admin_read
  on public.spot_released_emails
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.spot_released_emails to authenticated;

-- ── Close a deadline once it no longer applies ──────────────────────────────
-- Payment status changes are raw table writes from the Payments screen, so a
-- trigger is the only place that sees all of them.
create or replace function public.registrations_resolve_payment_deadline()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog, public, extensions'
as $function$
begin
  if NEW.status = 'registered'
     and coalesce(NEW.payment_status, 'unpaid') not in ('paid', 'transferred') then
    return null;
  end if;

  update public.payment_deadlines d
     set status = 'resolved', closed_at = now()
   where d.registration_id = NEW.id
     and d.status = 'active';
  return null;
end;
$function$;

revoke execute on function public.registrations_resolve_payment_deadline() from public, anon, authenticated;
grant execute on function public.registrations_resolve_payment_deadline() to service_role;

drop trigger if exists registrations_resolve_payment_deadline on public.registrations;
create trigger registrations_resolve_payment_deadline
  after update of status, payment_status on public.registrations
  for each row execute function public.registrations_resolve_payment_deadline();

-- ── get_payment_reminder ────────────────────────────────────────────────────
-- get_payment_reminder_link plus an optional deadline. With input_grace_hours
-- the message ends with the pay-by time and the deadline is returned so the
-- client can record exactly what the player was told. The deadline is rounded
-- up to the minute because the message shows HH:MI.
create or replace function public.get_payment_reminder(
  input_registration_id uuid,
  input_grace_hours integer default null
)
returns table(url text, deadline_at timestamptz)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_player_id uuid;
  v_tournament_id uuid;
  v_player_name text;
  v_phone text;
  v_tournament_name text;
  v_tikkie_link text;
  v_digits text;
  v_message text;
  v_deadline timestamptz;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();

  if input_grace_hours is not null and input_grace_hours not between 1 and 168 then
    raise exception 'invalid_grace_hours' using errcode = 'P0001',
      detail = 'input_grace_hours must be between 1 and 168.';
  end if;

  select r.player_id, r.tournament_id
    into v_player_id, v_tournament_id
    from public.registrations r
   where r.id = input_registration_id;

  if v_player_id is null then
    raise exception 'registration_not_found' using errcode = 'P0002';
  end if;

  select p.name, p.phone into v_player_name, v_phone
    from public.players p where p.id = v_player_id;

  select t.name, t.tikkie_link into v_tournament_name, v_tikkie_link
    from public.tournaments t where t.id = v_tournament_id;

  -- Audited unconditionally (the phone column was read either way); succeeded
  -- records whether a usable link came out. See 20260807140000.
  if coalesce(v_tikkie_link, '') = '' then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return;
  end if;

  v_digits := regexp_replace(coalesce(v_phone, ''), '[\s\-()]', '', 'g');
  if v_digits !~ '^\+\d{8,15}$' then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (v_player_id, 'payment_reminder', false);
    return;
  end if;
  v_digits := regexp_replace(v_digits, '^\+', '');

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (v_player_id, 'payment_reminder', true);

  v_message := 'Hi ' || coalesce(nullif(v_player_name, ''), 'there')
    || '! Friendly reminder to pay for ' || coalesce(nullif(v_tournament_name, ''), 'the event')
    || ' via Tikkie: ' || v_tikkie_link || ' 🙏';

  if input_grace_hours is not null then
    v_deadline := date_trunc('minute', now() + make_interval(hours => input_grace_hours))
                  + interval '1 minute';
    v_message := v_message || ' If it isn''t paid by '
      || to_char(v_deadline at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMon, HH24:MI')
      || ', your spot will be released to other Lobsters.';
  end if;

  return query select 'https://wa.me/' || v_digits || '?text=' || public._url_encode(v_message),
                      v_deadline;
end;
$function$;

-- Kept so a client still on the previous build keeps working until it
-- reloads. Safe to drop once nothing calls it.
create or replace function public.get_payment_reminder_link(input_registration_id uuid)
returns text
language sql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
  select g.url from public.get_payment_reminder(input_registration_id, null) g;
$function$;

-- ── admin_start_payment_deadline ────────────────────────────────────────────
-- Called when the admin taps "Send via WhatsApp". Takes the deadline returned
-- by get_payment_reminder rather than re-deriving it, so the recorded deadline
-- is exactly the one in the message. A new reminder supersedes the old one.
create or replace function public.admin_start_payment_deadline(
  input_registration_id uuid,
  input_deadline_at timestamptz
)
returns table(status text, deadline_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_reg public.registrations%rowtype;
  v_id uuid;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();

  if input_deadline_at is null
     or input_deadline_at <= now()
     or input_deadline_at > now() + interval '169 hours' then
    return query select 'invalid_deadline'::text, null::uuid; return;
  end if;

  select * into v_reg from public.registrations r
   where r.id = input_registration_id
   for update;
  if not found then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if v_reg.status <> 'registered' then
    return query select 'not_registered'::text, null::uuid; return;
  end if;
  if coalesce(v_reg.payment_status, 'unpaid') in ('paid', 'transferred') then
    return query select 'already_paid'::text, null::uuid; return;
  end if;

  update public.payment_deadlines d
     set status = 'superseded', closed_at = now()
   where d.registration_id = v_reg.id
     and d.status = 'active';

  insert into public.payment_deadlines (registration_id, tournament_id, player_id, deadline_at)
  values (v_reg.id, v_reg.tournament_id, v_reg.player_id, input_deadline_at)
  returning id into v_id;

  return query select 'started'::text, v_id;
end
$function$;

-- ── Spot-released email ─────────────────────────────────────────────────────
-- input_spots = 0 still sends the admin report (a deadline cancel in an event
-- that wasn't full) but no player email. The players who just lost the spot
-- are left out of the announcement.
create or replace function private.send_spot_released_email(
  input_tournament_id uuid,
  input_spots integer,
  input_released_player_ids uuid[],
  input_trigger_source text
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_url text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-spot-released';
  v_key text;
  v_t record;
  v_recipients jsonb := '[]'::jsonb;
  v_released jsonb;
  v_req bigint;
begin
  v_key := private.get_edge_service_role_key();
  if v_key is null then
    raise warning 'send_spot_released_email: vault secret missing, email not sent';
    return;
  end if;

  select t.id, t.name,
         to_char(public.tournament_start_ts(t.id) at time zone 'Europe/Amsterdam',
                 'FMDy FMDD FMMonth, HH24:MI') as when_label
    into v_t
    from public.tournaments t where t.id = input_tournament_id;

  if input_spots > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'player_id',  p.id::text,
             'first_name', private.first_name(p.name),
             'email',      trim(p.email)
           ) order by p.name), '[]'::jsonb)
      into v_recipients
      from public.players p
     where p.status = 'active'
       and p.id <> all(input_released_player_ids)
       and trim(coalesce(p.email, '')) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       and not exists (
         select 1 from public.registrations r
          where r.tournament_id = input_tournament_id
            and r.player_id = p.id
            and r.status = 'registered'
       );
  end if;

  select coalesce(jsonb_agg(p.name order by p.name), '[]'::jsonb)
    into v_released
    from public.players p where p.id = any(input_released_player_ids);

  select net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'tournament_id',   v_t.id::text,
      'tournament_name', v_t.name,
      'when_label',      trim(v_t.when_label),
      'spots',           input_spots,
      'trigger_source',  input_trigger_source,
      'released_names',  v_released,
      'recipients',      v_recipients
    ),
    headers := jsonb_build_object('authorization', 'Bearer ' || v_key,
                                  'content-type', 'application/json'),
    timeout_milliseconds := 60000
  ) into v_req;

  insert into public.spot_released_emails
    (tournament_id, trigger_source, spots, recipient_count, released_player_ids, net_request_id)
  values
    (input_tournament_id, input_trigger_source, input_spots,
     jsonb_array_length(v_recipients), input_released_player_ids, v_req);
end
$function$;

revoke execute on function private.send_spot_released_email(uuid, integer, uuid[], text)
  from public, anon, authenticated;

-- ── cancel_registration: release, don't promote ─────────────────────────────
-- Previously promoted the oldest waitlister into the freed spot. Now the spot
-- is released, and if the event was full before the cancel everyone is told.
-- "Was full" and "a spot opened" are both required: an event over its cap
-- (LOBS #10 at 26/24) is still full after one cancel, so nothing opened.
drop function if exists public.cancel_registration(uuid);
create function public.cancel_registration(input_registration_id uuid)
returns table(status text, spot_released boolean)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_tournament_id uuid;
  v_reg public.registrations%rowtype;
  v_max integer;
  v_before integer;
begin
  set local statement_timeout = '30s';
  perform set_config('app.audit_source', 'cancel_registration', true);
  perform public.require_admin();

  select r.tournament_id into v_tournament_id
    from public.registrations r where r.id = input_registration_id;
  if not found then
    return query select 'not_found'::text, false; return;
  end if;

  select t.max_players into v_max
    from public.tournaments t where t.id = v_tournament_id
   for update;

  select * into v_reg from public.registrations r
   where r.id = input_registration_id
   for update;
  if not found then
    return query select 'not_found'::text, false; return;
  end if;
  if v_reg.status = 'cancelled' then
    return query select 'already_cancelled'::text, false; return;
  end if;

  select count(*) into v_before
    from public.registrations r
   where r.tournament_id = v_reg.tournament_id
     and r.status = 'registered';

  update public.registrations r set status = 'cancelled' where r.id = v_reg.id;

  if v_reg.status = 'registered' and v_before >= v_max and v_before - 1 < v_max then
    perform private.send_spot_released_email(
      v_reg.tournament_id, v_max - (v_before - 1), array[v_reg.player_id], 'admin_cancel'
    );
    return query select 'cancelled'::text, true; return;
  end if;

  return query select 'cancelled'::text, false;
end
$function$;

-- ── register_for_tournament: a waitlister can take an open spot ─────────────
-- Unchanged except for the 'waitlist' branch: with a free spot, the existing
-- waitlist row moves to registered instead of reporting already_waitlist.
-- Same tournament lock and capacity trigger, so two people grabbing one spot
-- at once still yields one registration.
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

  select t.max_players into v_max
    from public.tournaments t where t.id = input_tournament_id
   for update;
  if not found then
    return query select 'not_found'::text, null::uuid; return;
  end if;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.status = 'registered';

  select * into v_existing
    from public.registrations r
   where r.tournament_id = input_tournament_id
     and r.player_id = input_player_id
     and r.status in ('registered', 'waitlist')
   limit 1;
  if found then
    if v_existing.status = 'waitlist' and v_count < v_max then
      update public.registrations r set status = 'registered' where r.id = v_existing.id;
      return query select 'registered'::text, v_existing.id; return;
    end if;
    return query select ('already_' || v_existing.status)::text, v_existing.id; return;
  end if;

  v_status := case when v_count < v_max then 'registered' else 'waitlist' end;

  insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  values (input_tournament_id, input_player_id, v_status, 'unpaid', '')
  returning id into v_id;

  return query select v_status, v_id;
end
$function$;

-- ── expire_payment_deadlines (hourly) ───────────────────────────────────────
-- Per tournament, under the tournament lock: cancel every due, still-unpaid
-- registration, then send one email covering all of them.
create or replace function private.expire_payment_deadlines()
returns table(out_tournament_id uuid, released integer, spots_opened integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_tid uuid;
  v_max integer;
  v_started boolean;
  v_before integer;
  v_after integer;
  v_d public.payment_deadlines%rowtype;
  v_reg public.registrations%rowtype;
  v_released uuid[];
begin
  set local statement_timeout = '120s';
  perform set_config('app.audit_source', 'payment_deadline_expired', true);

  for v_tid in
    select distinct d.tournament_id
      from public.payment_deadlines d
     where d.status = 'active' and d.deadline_at <= now()
  loop
    select t.max_players into v_max
      from public.tournaments t where t.id = v_tid
     for update;
    v_started := public.tournament_start_ts(v_tid) <= now();
    v_released := '{}';

    select count(*) into v_before
      from public.registrations r
     where r.tournament_id = v_tid and r.status = 'registered';

    for v_d in
      select * from public.payment_deadlines d
       where d.tournament_id = v_tid
         and d.status = 'active'
         and d.deadline_at <= now()
       order by d.deadline_at
       for update
    loop
      select * into v_reg from public.registrations r
       where r.id = v_d.registration_id
       for update;

      if not v_started
         and v_reg.status = 'registered'
         and coalesce(v_reg.payment_status, 'unpaid') = 'unpaid' then
        update public.payment_deadlines d
           set status = 'expired', closed_at = now()
         where d.id = v_d.id;
        update public.registrations r set status = 'cancelled' where r.id = v_reg.id;
        v_released := v_released || v_reg.player_id;
      else
        update public.payment_deadlines d
           set status = 'resolved', closed_at = now()
         where d.id = v_d.id;
      end if;
    end loop;

    if cardinality(v_released) = 0 then
      continue;
    end if;

    select count(*) into v_after
      from public.registrations r
     where r.tournament_id = v_tid and r.status = 'registered';

    out_tournament_id := v_tid;
    released := cardinality(v_released);
    spots_opened := case when v_before >= v_max and v_after < v_max
                         then v_max - v_after else 0 end;

    perform private.send_spot_released_email(v_tid, spots_opened, v_released, 'payment_deadline');
    return next;
  end loop;
end
$function$;

revoke execute on function private.expire_payment_deadlines() from public, anon, authenticated;

select cron.unschedule('expire-payment-deadlines')
 where exists (select 1 from cron.job where jobname = 'expire-payment-deadlines');
select cron.schedule('expire-payment-deadlines', '15 * * * *',
                     'select private.expire_payment_deadlines();');

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke execute on function public.get_payment_reminder(uuid, integer) from public, anon;
revoke execute on function public.get_payment_reminder_link(uuid) from public, anon;
revoke execute on function public.admin_start_payment_deadline(uuid, timestamptz) from public, anon;
revoke execute on function public.cancel_registration(uuid) from public, anon;
revoke execute on function public.register_for_tournament(uuid, uuid) from public, anon;

grant execute on function public.get_payment_reminder(uuid, integer) to authenticated;
grant execute on function public.get_payment_reminder_link(uuid) to authenticated;
grant execute on function public.admin_start_payment_deadline(uuid, timestamptz) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.register_for_tournament(uuid, uuid) to authenticated;
