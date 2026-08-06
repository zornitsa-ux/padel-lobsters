-- ============================================================================
-- Registrations are no longer hard-deleted.
--
-- `status = 'cancelled'` already records a player leaving an event, and it is
-- the right record whether they were registered or waitlisted. What was missing
-- is that rows could still vanish outright, taking their history — and, once
-- 20260806210842 landed, the audit trail's subject — with them. Three vectors
-- existed; none of them were in the app's own query layer, which only ever
-- UPDATEs.
--
--   1. `registrations_self_delete` RLS policy
--   2. deleting a tournament, via ON DELETE CASCADE
--   3. deleting a player, via ON DELETE CASCADE
--
-- Each is closed below.
-- ============================================================================

-- ── 1. Players can no longer delete their own registrations ─────────────────
-- Nothing in the app ever called this, but PostgREST exposed it: an
-- authenticated player could DELETE /rest/v1/registrations?player_id=eq.<self>
-- and erase their entire history, including completed events they hold match
-- results in. Leaving a tournament is `cancelled`, which the update policy
-- already permits — there is no legitimate use for the delete path.
drop policy if exists registrations_self_delete on public.registrations;

-- ── 2. Deleting an event with registrations now fails loudly ────────────────
-- The admin UI deletes an event behind a single confirm dialog, which cascaded
-- away its registrations, matches, raffle winners, Oscars session and rating
-- events with no undo. RESTRICT preserves the legitimate use — removing an
-- event created by mistake, which has no registrations — and blocks the
-- destructive one. Because this FK is checked first, it protects the whole
-- event: the other cascades never get the chance to fire.
alter table public.registrations
  drop constraint if exists registrations_tournament_id_fkey;
alter table public.registrations
  add constraint registrations_tournament_id_fkey
  foreign key (tournament_id) references public.tournaments(id)
  on delete restrict;

-- ── 3. Deleting a player is now a soft delete ───────────────────────────────
-- `players.status` is already a lifecycle field carrying 'active',
-- 'placeholder' and 'pending', so 'deleted' joins an established pattern rather
-- than introducing a new concept. The registrations.player_id CASCADE is left
-- in place but becomes unreachable in normal operation.
--
-- The email is cleared as part of the soft delete, for two reasons. First,
-- players.id *is* auth.users.id and sync_player_email_to_auth() mirrors the
-- address across — so leaving it in place would let a "deleted" player keep
-- requesting magic links and logging back in. Clearing it makes that trigger
-- write the synthetic player-<uuid>@padelobsters.internal address it already
-- uses when an admin blanks an email, which revokes the login path. Second,
-- auth.users has its own unique constraint on email, so the address stays
-- blocked for re-signup unless it is released there too — the partial index
-- below is not sufficient on its own.
--
-- The trade-off is that a soft delete is lossy for contact details: restoring a
-- player restores their history but not their email. That is the right default
-- for a deletion, and full erasure is admin_purge_player.
--
-- Existing sessions are not revoked; per 20260518000014 that requires the Auth
-- Admin API. A deleted player holding a live session keeps it until expiry.
--
-- The pin_attempts audit insert is preserved: AdminSecurityPanels reads those
-- rows and an admin_action row is what makes the deletion visible there.
create or replace function public.admin_delete_player(input_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_rows integer := 0;
  v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_target_id is null then return false; end if;

  update public.players p
     set status = 'deleted',
         email = null
   where p.id = input_target_id
     and coalesce(p.status, 'active') <> 'deleted';
  get diagnostics v_rows = row_count;
  v_did_delete := v_rows > 0;

  if v_did_delete then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (input_target_id, 'admin_action', true);
  end if;
  return v_did_delete;
end $function$;

comment on function public.admin_delete_player(uuid) is
  'Soft-deletes a player (players.status = ''deleted''). Registrations and match history are preserved. For genuine erasure (GDPR) use admin_purge_player, which is service_role only.';

-- players_email_lower_unique is a partial unique index on lower(email), so any
-- address left on a soft-deleted row would be permanently unable to sign up
-- again. admin_delete_player already clears the email, which makes this
-- predicate redundant today; it is here so that clearing the email stays a
-- choice about login access rather than the only thing keeping the address
-- re-usable.
drop index if exists public.players_email_lower_unique;
create unique index players_email_lower_unique
  on public.players (lower(email))
  where email is not null
    and email <> ''
    and coalesce(status, 'active') <> 'deleted';

-- ── 4. A deliberate erasure path ────────────────────────────────────────────
-- Soft deletion means retention, so a real "remove this person entirely"
-- operation still has to exist for a GDPR request. Kept separate from the
-- routine admin button and granted to service_role only — it is not reachable
-- from the app, and running it requires deliberate access to the service key.
-- No require_admin() call: a service_role JWT carries role='service_role', not
-- app_metadata.role='admin', so the grant *is* the access control here.
--
-- registrations cascade away with the player, which is the intent. The
-- registration_status_events rows survive by design (they have no foreign
-- keys) and contain no PII — only uuids and status strings.
create or replace function public.admin_purge_player(input_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  if input_target_id is null then return false; end if;
  with del as (
    delete from public.players p where p.id = input_target_id returning 1
  ) select exists(select 1 from del) into v_did_delete;
  return v_did_delete;
end $function$;

comment on function public.admin_purge_player(uuid) is
  'Hard-deletes a player and cascades their registrations. GDPR erasure only; service_role grant is the access control. Routine removal is admin_delete_player.';

revoke execute on function public.admin_purge_player(uuid) from public;
revoke execute on function public.admin_purge_player(uuid) from anon;
revoke execute on function public.admin_purge_player(uuid) from authenticated;
grant execute on function public.admin_purge_player(uuid) to service_role;
