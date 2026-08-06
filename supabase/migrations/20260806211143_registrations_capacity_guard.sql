-- ============================================================================
-- registered <= max_players, enforced in the database.
--
-- Why: LOBS #10 reached 26 registered on a 24-player event. Capacity was only
-- ever checked in the client, by counting the TanStack Query cache before
-- inserting (useRegistrations.ts). That count falls back to 0 when the cache is
-- cold, is stale whenever a tab has been backgrounded, and is per-tab, so
-- concurrent sign-ups never see each other. A comment in that file asserted
-- that "the server's own insert-guard is the authoritative check" — there was
-- no such guard. This is it.
--
-- The invariant holds for every role and every path: self-registration, an
-- admin adding someone, waitlist promotion, and transfer acceptance. There is
-- deliberately no admin override — to add a spot, raise max_players on the
-- event. One rule, no exceptions, nothing conditional for the audit trail to
-- have to explain.
--
-- Accepted consequence: an event that is *already over* its cap cannot take a
-- transfer. apply_registration_transfer cancels the from-side and registers the
-- to-side, and that second write still sees a count at or above max_players, so
-- the whole swap aborts. At or below cap a transfer is unaffected (the cancel
-- drops the count first). An event can only be over cap through legacy data or
-- an admin lowering max_players below the current head count; the fix in both
-- cases is to raise max_players or cancel the surplus registrations.
--
-- Concurrency: the FOR UPDATE on the parent tournaments row is what makes this
-- correct, not decoration. Without it two simultaneous inserts both read 24,
-- both pass, and the event ends up at 26 again — the exact failure this
-- replaces. Serialising on the tournament row is cheap; contention is per
-- event and each hold is sub-millisecond.
--
-- Lock order: the tournaments row is the serialisation point and every RPC in
-- 20260806211259 takes it first, before touching any registration. This trigger
-- takes it again, which is a no-op inside those RPCs (same transaction, lock
-- already held) but still serialises any write that reaches the table by
-- another route. The residual case is a raw UPDATE running concurrently with an
-- RPC, which can take the two in opposite orders; Postgres would detect that
-- and abort one side. Raw writes are exactly what `source = 'direct'` in
-- registration_status_events exists to make visible.
-- ============================================================================

create or replace function public.registrations_enforce_capacity()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog, public, extensions'
as $function$
declare
  v_max integer;
  v_count integer;
begin
  -- Only transitions *into* registered can breach the cap.
  if NEW.status is distinct from 'registered' then
    return NEW;
  end if;

  -- Already registered and staying registered: payment_status edits, method
  -- changes, transfer bookkeeping. No count change, nothing to check.
  if TG_OP = 'UPDATE' and OLD.status = 'registered' then
    return NEW;
  end if;

  select t.max_players into v_max
    from public.tournaments t
   where t.id = NEW.tournament_id
   for update;

  select count(*) into v_count
    from public.registrations r
   where r.tournament_id = NEW.tournament_id
     and r.status = 'registered'
     and r.id <> NEW.id;

  if v_count >= v_max then
    raise exception 'tournament_full'
      using errcode = 'P0001',
            detail = format(
              'Tournament %s is at capacity (%s/%s registered); cannot register player %s.',
              NEW.tournament_id, v_count, v_max, NEW.player_id
            ),
            hint = 'Raise max_players on the event to create more spots.';
  end if;

  return NEW;
end;
$function$;

-- Trigger functions are never invoked directly by a client role; the default
-- PUBLIC grant that CREATE FUNCTION hands out is revoked to match the deny-all
-- baseline established in 20260727194010.
revoke execute on function public.registrations_enforce_capacity() from public;
revoke execute on function public.registrations_enforce_capacity() from anon;
revoke execute on function public.registrations_enforce_capacity() from authenticated;
grant execute on function public.registrations_enforce_capacity() to service_role;

drop trigger if exists registrations_enforce_capacity on public.registrations;
create trigger registrations_enforce_capacity
  before insert or update on public.registrations
  for each row execute function public.registrations_enforce_capacity();
