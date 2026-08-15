# Registration integrity — decision record

Shipped on `fix/registration-capacity-guard`. Fixes the defect that put **26
registered on a 24-player event** (`adea6641-d13a-4dab-a66d-fad7bb232921`, LOBS
#10 Smash & Sizzle) and closes the gaps that made it take a full investigation
to explain.

This records **why** the code looks the way it does. The what lives in the
migrations (`20260806210842`, `20260806211102`, `20260806211143`,
`20260806211259`, `20260806213000`) and in
`supabase/tests/registration_integrity.sql`.

## 1. Root cause

The client promoted the oldest waitlisted player after **every** cancellation:

```ts
await q.cancelRegistration(id)
const cached = qc.getQueryData(...) ?? []
await q.promoteWaitlist(tournamentId, cached)   // unconditional
```

`status = 'cancelled'` was never the problem — it is the correct record whether
the player was registered or waitlisted. The defect is that the promotion keyed
off _the fact that a cancel happened_ rather than _what the row's status was
before it happened_:

- Registered player cancels → they occupied a spot → promote W1. ✅
- Waitlisted player cancels → they occupied nothing → promote nobody. ✅

Both are cancellations; only one frees capacity. Every waitlist cancellation was
a net **+1 over capacity**. It happened twice on LOBS #10 (Lara's cancel promoted
Lucas to 25; Mert's promoted Mario to 26).

That reconstruction was inference from `created_at` plus two corroborating
details — Lucas (`tikkied`) and Mario (`unpaid`) were the only registered players
not `paid`, and the surviving waitlist was exactly the two sitting behind them.
Had both already paid, there would have been a plausible story and no way to
confirm it. That is why the audit trail exists.

Three contributing defects surfaced while tracing:

1. **No server-side capacity guard existed.** A comment in `useRegistrations.ts`
   claimed "the server's own insert-guard is the authoritative check" — verified
   false. Capacity was a TanStack-cache count that reads `0` when cold, is stale
   on a backgrounded tab, and is per-tab.
2. **The waitlist "Confirm" button had no capacity check at all** — it wrote
   `status: 'registered'` straight to the table.
3. **`respond_to_transfer` could add without subtracting.** The from-side UPDATE
   was guarded `AND status = 'registered'`; if that player had already cancelled
   it matched zero rows, but `IF NOT FOUND` referred to the _second_ UPDATE, so
   the recipient was registered anyway.

## 2. Decisions

**D-1 — Hard block, no bypass.** `registered <= max_players` holds for every role
and every path: self-registration, admin add, waitlist promotion, transfers. To
add a spot an admin raises `max_players`. No override flag — one rule, nothing
conditional for the audit trail to have to explain.

**D-2 — Capacity is decided server-side.** The client cache count is unfixable
(cold, stale, per-tab). The registered-vs-waitlist decision moved into RPCs that
lock the tournament row and count under that lock. The trigger stays as the
backstop for anything reaching the table by another route.

**D-3 — `cancelled` is sufficient; no `deleted_at` on registrations.** An earlier
draft proposed a soft-delete column to distinguish "player pulled out" from "this
row shouldn't exist". Dropped: the distinction is theoretical here and would have
threaded a `deleted_at IS NULL` predicate through 8 RPCs, the unique index and
both client fetches for no operational gain.

**D-4 — The audit table has no foreign keys.** An earlier draft had
`tournament_id` / `player_id` referencing their parents `ON DELETE CASCADE`,
which meant deleting a tournament would erase the audit trail explaining what
happened to its registrations — the log being exactly as durable as the thing it
exists to outlive. Bare `uuid` columns instead. Useful side effect: the table
holds no PII, only uuids and status strings.

**D-5 — LOBS #10's rows are left alone.** The guard blocks new transitions and
does not rewrite existing rows; that event is handled out of band.

**D-6 — `source` is what makes the audit trail worth having.** Each RPC sets a
transaction-local `app.audit_source` GUC that the trigger records. A promotion
tagged `cancel_registration` is the automatic one; the same transition tagged
`promote_waitlist_registration` is an admin pressing Confirm. `direct` means a
raw write that bypassed every RPC — rare after this work, so its presence is
itself worth alerting on.

**D-7 — `max_players` has exactly one meaning.** It was nullable with a default
of 16, and the two sides had settled on different readings: the RPCs treated null
as unlimited and 0 as zero spots, the client read both as 16. So an event with a
null cap registered everyone while the UI showed "N of 16". Neither state is
meaningful for this club — every event is a booked number of courts — so the
column is now `NOT NULL CHECK (> 0)` and both sides dropped their fallbacks.
Existing nulls backfilled to 16, which is what the UI was already showing.

**D-8 — Transfers on an _over_-capacity event are refused, and that is
accepted.** The swap cancels the from-side then registers the to-side; on an
event already above cap the second write still sees `count >= max_players` and
the whole transaction aborts. At or below cap transfers are unaffected. Honouring
D-1 was judged worth more than the edge case. An event can only be over cap
through legacy data or an admin lowering `max_players` below the current head
count; the fix in both cases is to raise it back or cancel the surplus.

**D-9 — Deleted players are filtered where they are _offered_, never where they
are _looked up_.** Deleting a player is a soft delete (their history has to
survive), so the roster query still returns them. Every list that offers someone
as a choice excludes `status = 'deleted'` via `isSelectablePlayer`; lookups by id
are deliberately untouched so past events keep resolving names.

**D-11 — A transfer never revives a cancelled row.** `apply_registration_transfer`
resolves the recipient's single _active_ row (`registered` or `waitlist` — the
`registrations_tournament_player_active_uniq` index already guarantees at most
one exists) and branches on it: already `registered` returns
`to_already_registered` before any write; `waitlist` is promoted in place by
id; no active row means a fresh row is INSERTed. Stale `cancelled` rows are
never touched. This matches `register_for_tournament`'s existing stance ("a
new row rather than reviving a cancelled one: the cancellation stays in the
record, and `registration_status_events` shows both") and keeps a `cancelled`
row's `payment_method` — which can itself be evidence of an earlier transfer —
intact. See §6 for why this mattered in practice.

**D-10 — Deleting an event is for events nobody ever signed up for.** The
`ON DELETE RESTRICT` on `registrations.tournament_id` applies to cancelled rows
too, and registrations are never hard-deleted — so an event where _everyone_
cancelled is also permanently undeletable. Accepted rather than carving out an
exemption; `handleDelete` maps SQLSTATE 23503 to copy that says so.

## 3. As built — where implementation diverged

- **Soft-deleting a player has to clear their email.** `players.id` _is_
  `auth.users.id` and `sync_player_email_to_auth()` mirrors the address across,
  so leaving it would let a "deleted" player keep requesting magic links and
  logging back in. `auth.users` also has its own unique constraint on email, so
  the address stayed blocked for re-signup even with the partial index fixed.
  `admin_delete_player` nulls the email, which makes that existing trigger write
  the synthetic `player-<uuid>@padelobsters.internal` address it already uses
  when an admin blanks a field.
- **The transfer swap was extracted rather than fixed twice.**
  `respond_to_transfer` and `admin_force_accept_transfer` carried it as two
  verbatim copies, including the bug. Both now call
  `apply_registration_transfer`.
- **`admin_purge_player` added** for GDPR erasure, granted to `service_role`
  only — deliberately not reachable from the app. Soft delete means retention,
  so genuine erasure needs a separate deliberate path.
- **Lock order: tournaments row first, always.** Every RPC takes it before
  touching a registration; the trigger re-takes it, a no-op inside those RPCs but
  still serialising writes arriving by other routes. `cancel_registration` reads
  its registration row a second time `FOR UPDATE` under that lock — trusting the
  first read let two concurrent cancels of the same id both conclude they had
  freed a spot and promote two waitlisters into one opening.
- **Every non-success RPC status has words.** The RPCs answer with a status
  string instead of throwing, so `registrationStatusMessages.ts` maps them, and
  `cancelRegistration` / `promoteWaitlistRegistration` own their error handling
  in the hook the way `updateRegistration` already did — the click handlers have
  no try/catch and the query layer throws. Silence here reads as a dead button.

## 4. Open

- **LOBS #10 was resolved by raising its cap, not by draining.** It shipped at
  26/24; as of 2026-08-11 it is 28/28 — an admin raised `max_players` to 28
  rather than waiting for cancellations, which D-8 always allowed as the fix.
- **Soft-deleting a player does not cancel their registrations.** A deleted
  player still occupies a spot on any upcoming event they had joined and still
  renders in that event's Registered list, which draws from registrations rather
  than the roster. Cancelling those rows means deciding whether it should promote
  waitlisters — the same semantics as `cancel_registration` — so it is left for a
  separate change.

## 5. Deployment

Migrations must land **before** the frontend deploys — the client calls RPCs that
will not exist otherwise. Prod has a history of hand-applied migrations raising
the remote head, so run `npx supabase migration list` and reconcile drift before
`npx supabase db push`.

## 6. 2026-08-14 — transfer acceptance aborting with 23505

Both transfer paths (`respond_to_transfer` and the admin force-accept) started
failing in production: accepting a transfer raised `duplicate key value
violates unique constraint "registrations_tournament_player_active_uniq"` and
rolled back. Confirmed in Postgres logs (six occurrences, 2026-08-14
15:30–15:33) and in the data — recipients holding a `registered` row plus two
stale `cancelled` rows, or a `cancelled` row plus a `waitlist` row, on the same
tournament.

`apply_registration_transfer`'s second UPDATE matched the recipient's row by
`(tournament_id, player_id, status IN ('waitlist', 'cancelled'))` with no
row-id scoping. That predicate is not new — it was carried verbatim from the
two copies in `respond_to_transfer` / `admin_force_accept_transfer` that this
migration's own function extracted — so the Aug 6 refactor did not introduce
it. What made it reachable is `20260806211102` (no hard deletes): before that,
cancelled rows could in principle be pruned; after it, a recipient who
cancels or gets transferred more than once on the same event permanently
accumulates extra `cancelled` rows. Once a recipient had two or more rows
matching that predicate, the UPDATE flipped all of them to `'registered'` in
one statement, producing a duplicate active row for the same
`(tournament_id, player_id)` pair. The lesson worth keeping: "no hard
deletes" changes the cardinality assumptions of every query in the codebase
that matches rows by natural key instead of by id, not just the ones the
migration touched directly.

Fixed by resolving the recipient's row before writing anything (D-11) instead
of inferring behaviour from an UPDATE's row count — the same class of mistake
as the `IF NOT FOUND` bug from §1. See
`20260815050555_fix_apply_registration_transfer_row_scope.sql` and CHECK
14a–14f in `supabase/tests/registration_integrity.sql`. No data remediation
was needed: per D-5, the guard blocks new transitions without rewriting
existing rows, and the stale `cancelled` rows are inert once nothing selects
them by natural key anymore.
