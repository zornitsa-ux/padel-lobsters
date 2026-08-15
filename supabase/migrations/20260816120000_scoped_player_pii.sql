-- Scoped, per-player PII read — replaces the admin Players screen's bulk
-- roster-wide PII fetch with a single-player RPC, so opening the Players
-- page (or approving/browsing signups) no longer loads every player's
-- contact details as a side effect.
--
-- get_all_players_with_pii_v2 returns SETOF players (every column, every
-- player) and was fetched unconditionally on mount of the admin Players
-- screen. That's more exposure than any single admin action needs: editing,
-- approving, or linking one player only ever requires that one player's
-- contact details. This RPC returns a narrow, fixed projection for exactly
-- one player, so a page visit costs zero PII reads and each subsequent read
-- is auditable back to the specific player it was about.
--
-- Column choices:
--   * email/phone/birthday/notes — the fields the admin edit form and the
--     pending-signup link flow actually read.
--   * pin is deliberately NOT returned. Nothing in the client reads it any
--     more (PlayerProfileDrawer.tsx already documents "PIN itself is no
--     longer shown in admin UI"; the one remaining read was of the public
--     roster, which never had a pin column, so it was always undefined —
--     dead code, removed alongside this migration). Admins do not read or
--     look up players' PINs; regenerating one is a distinct, one-time
--     reveal (admin_regenerate_pin) that returns the freshly generated
--     value directly, never a stored one.
--   * pin_changes is NOT returned — it's already public via players_public.
--
-- Audit: a new attempt_kind, 'player_pii_read', distinct from 'pii_dump'.
-- Reusing 'pii_dump' would mislabel every future scoped read as "Full
-- roster PII read" in the admin security panel (see
-- 20260807140000_payment_reminder_rpc.sql, which made the same call for
-- payment-reminder sends). The audit row's player_id is the SUBJECT being
-- read (matching payment_reminder's convention), not the reading admin
-- (which is how pii_dump does it) — this is what lets the security panel
-- show "Player contact read · <player name>" per row.
--
-- No rate limit. get_all_players_with_pii_v2 had its 3-dumps/24h quota
-- removed in 20260726234531 because it constrained normal admin work
-- without a threat model that justified it, and its failure mode (empty
-- result) was actively dangerous — it made "rate limited" indistinguishable
-- from "this player has no contact details" to the client. That reasoning
-- applies with more force per-player: there's no sane per-player quota
-- number, and any cap would have to raise an exception rather than return
-- nothing. The audit trail (one row per read, naming the subject) is the
-- control; the admin security panel surfaces a read-count badge instead of
-- enforcing a limit.

alter table public.pin_attempts drop constraint if exists pin_attempts_attempt_kind_check;
alter table public.pin_attempts add constraint pin_attempts_attempt_kind_check
  check (attempt_kind = any(array[
    'player','admin','pii_dump','approve_device','admin_unlock','admin_action','signup','pin_reset',
    'payment_reminder','player_pii_read'
  ]));

-- Ordering is deliberate: select first, audit only if a row was actually
-- found. Inserting the audit row before the select recorded
-- 'player_pii_read'/succeeded=true even for a bogus/deleted id, inflating
-- the security panel's read-count badge with reads that returned nothing.
create or replace function public.admin_get_player_pii(input_target_id uuid)
returns table (id uuid, email text, phone text, birthday date, notes text)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_row record;
begin
  set local statement_timeout = '10s';
  perform public.require_admin();
  if input_target_id is null then
    raise exception 'missing target player' using errcode = '22023';
  end if;

  select p.id, p.email, p.phone, p.birthday, p.notes
    into v_row
    from public.players p
   where p.id = input_target_id;

  if not found then
    return;
  end if;

  insert into public.pin_attempts(player_id, attempt_kind, succeeded)
  values (input_target_id, 'player_pii_read', true);

  id := v_row.id; email := v_row.email; phone := v_row.phone;
  birthday := v_row.birthday; notes := v_row.notes;
  return next;
end;
$function$;

revoke execute on function public.admin_get_player_pii(uuid) from public, anon;
grant execute on function public.admin_get_player_pii(uuid) to authenticated;
