# Schema Improvements — Phase 1: Tournaments, Registrations, Matches, Players

**Scope:** Structural integrity and performance improvements for the four core tables.
**Risk level:** Low–Medium. All changes are additive constraints or indexes on existing data that already conforms.

---

## Context

A schema review identified several gaps in the core tables that predate the
newer subsystems (Oscars, transfers, leagues) which were built with stricter
constraints from the start. The key findings:

1. `registrations` FK columns are nullable despite always being populated
2. No unique constraint prevents duplicate (tournament, player) registrations
3. No indexes exist on the most-queried FK columns (`registrations.tournament_id`, `matches.tournament_id`)
4. Status columns use unconstrained text — any string is accepted
5. The `respond_to_transfer` and `admin_force_accept_transfer` RPCs have a
   latent bug: they do a blind INSERT for the transfer recipient, which creates
   a duplicate registration row when the recipient is already waitlisted

---

## Flow Verification (Cancellation & Transfer)

All proposed changes were traced against the three active write paths:

| Path                      | Mechanism                                                  | Status          |
| ------------------------- | ---------------------------------------------------------- | --------------- |
| Register player           | Direct `.insert()` via `src/api/registrations.js`          | Client-side     |
| Cancel + waitlist promote | Direct `.update()` via `src/api/registrations.js`          | Client-side     |
| Transfer (accept/force)   | `respond_to_transfer` / `admin_force_accept_transfer` RPCs | Server-side SQL |

### Cancellation flow

`cancelRegistration(id)` → sets `status = 'cancelled'` → `promoteWaitlist()`
picks the oldest `'waitlist'` row and updates it to `'registered'`.

- **NOT NULL on FKs:** No impact — cancel is an UPDATE on an existing row.
- **Unique partial index:** No impact — cancelled rows are excluded from the index.
  Re-registration after cancellation inserts a new row; only one non-cancelled
  row per (tournament, player) will exist.
- **CHECK on status:** Values used are `'registered'`, `'waitlist'`, `'cancelled'` — all in the allowed set.

**Verdict: No breakage. No change needed.**

### Transfer flow

`respond_to_transfer` does (in a single transaction):

1. `UPDATE registrations SET status = 'cancelled' WHERE player_id = from_player AND status = 'registered'`
2. `INSERT INTO registrations (player_id = to_player, status = 'registered')`

- **NOT NULL on FKs:** No impact — both tournament_id and player_id are always
  supplied from `registration_transfers` (which has NOT NULL on both).
- **CHECK on status:** Values written are `'cancelled'` and `'registered'` — both allowed.
- **⚠️ Unique partial index — BREAKS for waitlisted recipients:**
  If `to_player` already has a `'waitlist'` row, step 2 inserts a second
  non-cancelled row for the same (tournament, player), violating the unique
  constraint. The RPC would fail with a unique violation error.

  **This is a pre-existing bug** — even without the index, the app creates
  duplicate registrations for this scenario. The dead-code function
  `transferRegistration()` in `src/api/registrations.js` (lines 65–103)
  handled this correctly with an UPDATE-or-INSERT pattern. The server-side
  RPCs do not.

  **Fix:** Patch both `respond_to_transfer` and `admin_force_accept_transfer`
  to UPDATE existing waitlist/cancelled rows before falling back to INSERT.
  This fix must land in the **same migration** as the unique index.

---

## Tasks

### Task 1 — Fix transfer RPCs (bug fix)

**Priority:** High — blocks Task 3, also fixes a real data integrity bug
**Risk:** Low — adds a guard that makes the RPC idempotent

Patch `respond_to_transfer` and `admin_force_accept_transfer` to handle the
case where the transfer recipient already has a `waitlist` or `cancelled`
registration row. Instead of a blind INSERT, do:

```sql
-- Promote existing row if present
UPDATE public.registrations
   SET status = 'registered',
       payment_status = 'transferred',
       payment_method = 'transferred_from:' || v_xfer.from_player_id::text
 WHERE tournament_id = v_xfer.tournament_id
   AND player_id = v_xfer.to_player_id
   AND status IN ('waitlist', 'cancelled');

-- Only insert if no existing row was promoted
IF NOT FOUND THEN
  INSERT INTO public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  VALUES (
    v_xfer.tournament_id,
    v_xfer.to_player_id,
    'registered',
    'transferred',
    'transferred_from:' || v_xfer.from_player_id::text
  );
END IF;
```

**Affected functions:** `respond_to_transfer`, `admin_force_accept_transfer`
**Test scenario:** Create a tournament, register player A and waitlist player B.
Player A creates a transfer to player B. Player B accepts. Verify B has exactly
one `'registered'` row (not two).

---

### Task 2 — NOT NULL constraints on FK columns

**Priority:** High — zero-risk, prevents future bad data
**Risk:** None — verified zero NULL rows in current data

```sql
ALTER TABLE registrations ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE registrations ALTER COLUMN player_id SET NOT NULL;
ALTER TABLE matches ALTER COLUMN tournament_id SET NOT NULL;
```

**Data check (pre-migration):**

- `registrations`: 2 rows, 0 NULLs in either column ✓
- `matches`: 0 rows, 0 NULLs ✓

---

### Task 3 — Unique partial index on registrations

**Priority:** High — prevents duplicate registrations at DB level
**Risk:** Low — depends on Task 1 landing first
**Depends on:** Task 1

```sql
CREATE UNIQUE INDEX registrations_tournament_player_active_uniq
  ON registrations (tournament_id, player_id)
  WHERE status IN ('registered', 'waitlist');
```

This allows:

- One active (registered or waitlisted) row per (tournament, player) ✓
- Multiple cancelled rows (e.g. cancel → re-register → cancel again) ✓
- Transfer: from-player's row moves to 'cancelled' before to-player's row is created ✓

---

### Task 4 — Indexes on high-traffic FK columns

**Priority:** Medium — performance, no risk
**Risk:** None

```sql
CREATE INDEX registrations_tournament_id_idx
  ON registrations (tournament_id);

CREATE INDEX registrations_player_id_idx
  ON registrations (player_id);

CREATE INDEX matches_tournament_id_idx
  ON matches (tournament_id);
```

Note: Task 3's partial unique index already covers `(tournament_id, player_id)`
lookups for active rows. The plain `tournament_id` index serves broader queries
(e.g. `loadRegistrations` filtered by tournament, `promoteWaitlist`).

---

### Task 5 — CHECK constraints on status columns

**Priority:** Medium — prevents garbage data, zero risk
**Risk:** None — all current values conform

```sql
-- registrations.status
ALTER TABLE registrations
  ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('registered', 'waitlist', 'cancelled'));

-- registrations.payment_status
ALTER TABLE registrations
  ADD CONSTRAINT registrations_payment_status_check
  CHECK (payment_status IN ('unpaid', 'tikkied', 'pending_confirmation', 'paid', 'transferred'));

-- tournaments.status
ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('upcoming', 'active', 'completed'));
```

**Enumerated from code:**

- `registrations.status`: `'registered'`, `'waitlist'`, `'cancelled'` — used in `registerPlayer()`, `cancelRegistration()`, `promoteWaitlist()`, `respond_to_transfer`, and client-side filters in `utils.js`
- `registrations.payment_status`: `'unpaid'`, `'tikkied'`, `'pending_confirmation'`, `'paid'`, `'transferred'` — used in `Payments.jsx`, `PaymentStatusBadge.jsx`, `RegisteredSection.jsx`, `respond_to_transfer`
- `tournaments.status`: `'upcoming'`, `'active'`, `'completed'` — used in `Tournament.jsx`, `Dashboard.jsx`, and multiple components

---

### Task 6 — Remove dead code: `transferRegistration()`

**Priority:** Low — cleanup only
**Risk:** None — function is exported but never imported anywhere

`src/api/registrations.js` lines 65–104 define `transferRegistration()` which
was the pre-RPC client-side transfer implementation. It is never called — all
transfers now go through the `respond_to_transfer` / `admin_force_accept_transfer`
RPCs via `src/api/transfers.js`.

Remove the function and its comment block.

---

## Migration Plan

All DB changes should be a **single migration file** to ensure atomicity:

```
supabase/migrations/YYYYMMDDHHMMSS_schema_improvements_phase_1.sql
```

**Execution order within the migration:**

1. Fix `respond_to_transfer` (CREATE OR REPLACE FUNCTION)
2. Fix `admin_force_accept_transfer` (CREATE OR REPLACE FUNCTION)
3. ALTER TABLE — NOT NULL constraints
4. CREATE UNIQUE INDEX — partial unique on registrations
5. CREATE INDEX — performance indexes
6. ALTER TABLE — CHECK constraints

Order matters: the RPC fix (1–2) must precede the unique index (4), otherwise
any concurrent transfer-to-waitlisted-player during migration would fail.

---

## Out of Scope (Phase 2+)

These items were identified in the schema review but are not part of this phase:

- `merch_interests.player_id` text→uuid type fix + FK
- `merch_interests` redundant `paid`/`delivered` boolean columns
- `merch_items` redundant `image_url` column
- `raffle_winners.player_id` CASCADE→RESTRICT change
- `updated_at` columns + auto-update triggers on core tables
- `matches` UUID array normalization or GIN indexes
- `players.pin` plaintext column drop (tracked separately in ARCHITECTURE.md)
- `registrations → players` ON DELETE CASCADE→RESTRICT change
