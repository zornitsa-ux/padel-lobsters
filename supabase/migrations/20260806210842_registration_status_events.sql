-- ============================================================================
-- registration_status_events — an append-only log of registration status
-- transitions.
--
-- Why: LOBS #10 ended up with 26 registered on a 24-player event and there was
-- no way to establish how. `registrations` carries `created_at` and nothing
-- else, so every status change — waitlist → registered, registered → cancelled —
-- overwrites its own history. The cause was eventually reconstructed from
-- indirect evidence (waitlist ordering, and the fact that the two extra players
-- were the only registered players not marked `paid`), which happened to be
-- conclusive for that event and will not be next time.
--
-- No foreign keys, deliberately. An audit row is a statement about a moment in
-- time and must outlive everything it describes. An earlier draft had
-- tournament_id and player_id referencing their parents ON DELETE CASCADE,
-- which meant deleting a tournament would erase the log explaining what
-- happened to its registrations — the record being exactly as durable as the
-- thing it exists to outlive. Bare uuids instead. A useful consequence: this
-- table holds no PII, only uuids and status strings, so it survives a GDPR
-- purge of the player harmlessly.
--
-- Not added to `supabase_realtime`. That publication is deliberately empty —
-- live updates travel over Broadcast, which costs no disk IO (20260602000001,
-- 20260805160000). Adding a table here would silently reintroduce replication
-- load on an instance that has already been near its IO limit once.
-- ============================================================================

create table if not exists public.registration_status_events (
  id              bigint generated always as identity primary key,
  registration_id uuid not null,
  tournament_id   uuid not null,
  player_id       uuid not null,
  old_status      text,
  new_status      text,
  actor_id        uuid,
  actor_role      text,
  source          text not null default 'direct',
  created_at      timestamptz not null default clock_timestamp(),
  constraint registration_status_events_status_present
    check (old_status is not null or new_status is not null)
);

comment on table public.registration_status_events is
  'Append-only log of registrations.status transitions. No foreign keys: an audit row must outlive the rows it describes. Holds no PII.';
comment on column public.registration_status_events.old_status is
  'Null on INSERT.';
comment on column public.registration_status_events.new_status is
  'Null on DELETE.';
comment on column public.registration_status_events.actor_id is
  'auth.uid() at the time of the change. Null for service_role, raw SQL, and the migration baseline.';
comment on column public.registration_status_events.source is
  'Which code path made the change, from the app.audit_source GUC. ''direct'' means a raw table write that bypassed every RPC.';

create index if not exists registration_status_events_tournament_idx
  on public.registration_status_events (tournament_id, created_at);
create index if not exists registration_status_events_registration_idx
  on public.registration_status_events (registration_id, created_at);

-- ── Trigger ─────────────────────────────────────────────────────────────────
-- clock_timestamp() rather than now(): a cancel and the promotion it triggers
-- run in one transaction, and now() would give them an identical timestamp,
-- making the causal order unreadable — which is the single most important thing
-- this table has to record.
create or replace function public.registrations_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog, public, extensions'
as $function$
declare
  v_source text := coalesce(
    nullif(current_setting('app.audit_source', true), ''),
    'direct'
  );
  v_actor_id uuid := auth.uid();
  v_actor_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then
    return null;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.registration_status_events (
      registration_id, tournament_id, player_id,
      old_status, new_status, actor_id, actor_role, source
    ) values (
      OLD.id, OLD.tournament_id, OLD.player_id,
      OLD.status, null, v_actor_id, v_actor_role, v_source
    );
    return null;
  end if;

  insert into public.registration_status_events (
    registration_id, tournament_id, player_id,
    old_status, new_status, actor_id, actor_role, source
  ) values (
    NEW.id, NEW.tournament_id, NEW.player_id,
    case when TG_OP = 'UPDATE' then OLD.status else null end,
    NEW.status, v_actor_id, v_actor_role, v_source
  );
  return null;
end;
$function$;

-- Trigger functions are never invoked directly by a client role; the default
-- PUBLIC grant that CREATE FUNCTION hands out is revoked to match the deny-all
-- baseline established in 20260727194010.
revoke execute on function public.registrations_log_status_change() from public;
revoke execute on function public.registrations_log_status_change() from anon;
revoke execute on function public.registrations_log_status_change() from authenticated;
grant execute on function public.registrations_log_status_change() to service_role;

drop trigger if exists registrations_log_status_change on public.registrations;
create trigger registrations_log_status_change
  after insert or update or delete on public.registrations
  for each row execute function public.registrations_log_status_change();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Read-only to admins. No insert/update/delete policies at all: the SECURITY
-- DEFINER trigger above is the only writer, and it bypasses RLS.
alter table public.registration_status_events enable row level security;

drop policy if exists registration_status_events_admin_read
  on public.registration_status_events;
create policy registration_status_events_admin_read
  on public.registration_status_events
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.registration_status_events to authenticated;

-- ── Baseline ────────────────────────────────────────────────────────────────
-- One row per existing registration recording the status it holds right now.
-- These are a SNAPSHOT TAKEN AT MIGRATION TIME, not reconstructed history: the
-- transitions that produced these statuses were never recorded and cannot be
-- recovered. old_status is null and created_at is the migration timestamp, not
-- the time the status was actually reached. Everything from here on is real.
insert into public.registration_status_events (
  registration_id, tournament_id, player_id,
  old_status, new_status, actor_id, actor_role, source
)
select r.id, r.tournament_id, r.player_id,
       null, r.status, null, null, 'baseline'
from public.registrations r;
