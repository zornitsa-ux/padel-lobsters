-- ============================================================================
-- Event system EV6: when a spot was cancelled (docs/event-system/PLAN.md).
--
-- registrations.cancelled_at is set when a row becomes 'cancelled'. A trigger
-- sets it rather than each cancel path, so no path can miss it. Today these
-- write 'cancelled': private.cancel_registration_row, private.cancel_team_rows
-- (both also used by private.delete_account), public.apply_registration_transfer,
-- private.apply_team_transfer, public.respond_to_transfer and
-- public.change_team_partner.
--
-- No backfill: rows cancelled before this keep a null time.
-- registration_status_events has their history.
-- ============================================================================

alter table public.registrations add column cancelled_at timestamptz;

-- A cancelled row never becomes active again today; if one ever does, its
-- time goes with it.
alter table public.registrations add constraint registrations_cancelled_at_only_when_cancelled
  check (cancelled_at is null or status = 'cancelled');

create function private.registrations_stamp_cancelled()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status is distinct from 'cancelled' then
      new.cancelled_at := now();
    else
      new.cancelled_at := old.cancelled_at;
    end if;
  else
    new.cancelled_at := null;
  end if;
  return new;
end
$function$;
revoke all on function private.registrations_stamp_cancelled() from public, anon, authenticated;

create trigger registrations_stamp_cancelled
  before insert or update on public.registrations
  for each row execute function private.registrations_stamp_cancelled();
