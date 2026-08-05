-- ============================================================================
-- matches.updated_at — a monotonic watermark for score updates.
--
-- Why: several admins enter scores at once, and score updates now travel over
-- a Broadcast channel (20260729190000). Broadcast delivery is neither ordered
-- nor deduplicated, so without a version on the row a late or duplicated
-- message can silently apply a stale score over a newer one. Receivers compare
-- this column and drop any delta that isn't strictly newer than what they
-- already hold.
--
-- clock_timestamp() rather than now(): now() is transaction start time, so two
-- updates inside one transaction would share a watermark and be
-- indistinguishable to the guard.
--
-- Backfill: the default stamps every existing row at migration time. Those
-- values are not the real edit times, and nothing reads this column as history
-- — it exists only to order concurrent live updates.
-- ============================================================================

alter table public.matches
  add column if not exists updated_at timestamptz not null default clock_timestamp();

create or replace function public.matches_set_updated_at()
returns trigger language plpgsql
set search_path = 'pg_catalog, public, extensions'
as $function$
begin
  NEW.updated_at := clock_timestamp();
  return NEW;
end;
$function$;

-- Trigger functions are never invoked directly by a client role; the default
-- PUBLIC grant that CREATE FUNCTION hands out is revoked to match the deny-all
-- baseline established in 20260727194010.
revoke execute on function public.matches_set_updated_at() from public;
revoke execute on function public.matches_set_updated_at() from anon;
revoke execute on function public.matches_set_updated_at() from authenticated;
grant execute on function public.matches_set_updated_at() to service_role;

drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at
  before update on public.matches
  for each row execute function public.matches_set_updated_at();
