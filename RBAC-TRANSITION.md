# RBAC Transition Plan

Move from two shared PINs (admin + league_admin) to a per-account role system where every player has a single role derived from their own authenticated identity.

---

## Current State (Problem)

There are **three separate login paths** and **two shared secrets**:

| Path         | Mechanism                                                    | Problem                                                            |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Admin        | `verify_admin_pin_v2` RPC — global bcrypt PIN                | One PIN for all admins; not tied to any player account             |
| League admin | `settings.league_admin_pin` — plaintext, client-side compare | No hashing, leaks via `settings` table read; role being eliminated |
| Player       | `verify_player_pin_v2` RPC — per-player bcrypt               | Sound, but can't be used for authorization inside RPCs             |

The admin PIN is threaded as `input_admin_pin` into **every** admin-gated RPC (~40+ call sites across ~20–25 functions). There is no concept of "who is calling this RPC" — only "does the caller know the shared secret."

The role flags `players.is_admin` and `players.is_league_admin` already exist in the DB but are never used server-side for authorization. They are only read by the client after login to decide which UI to show.

---

## Target State

- **One login path**: player enters their PIN → client receives a session tied to their player ID
- **Role is a property of the player account**, not a separate credential
- **Server-side authorization** uses `auth.uid()` to look up the caller's role from `players`
- **No shared secrets** remain in the auth flow
- **Two roles only**: `player` and `admin` — league management is an admin capability

```
players.role  ∈ { 'player', 'admin' }
```

All admin RPCs check:

```sql
if not exists (select 1 from players where id = auth.uid() and role = 'admin') then
  raise exception 'unauthorized';
end if;
```

---

## Migration Phases

### Phase 1 — Formalize the Role Column ✅ Complete

**Goal**: single source of truth for role in the DB.

**DB migration** (`supabase/migrations/20260512000001_rbac_phase1_role_column.sql`):

```sql
-- Add role enum
create type public.player_role as enum ('player', 'admin');

-- Add column — all players start as 'player'
alter table public.players add column role public.player_role not null default 'player';

-- Designate admin players manually by name or known UUID:
-- update public.players set role = 'admin' where name = '<admin name>';
```

**No client changes yet** — this is additive.

**Why before Supabase Auth**: the `role` column needs to be populated correctly before any RPC reads it.

**Note on backfill**: there is no `players.is_admin` column — admin identity is currently a shared bcrypt PIN stored in `private.admin_secrets`, not a per-player flag. Admin players must be designated manually with a `UPDATE` using their known names or UUIDs.

---

### Phase 2 — Introduce Supabase Auth Sessions ✅ Complete

**Goal**: after a successful PIN verification, give the client a real Supabase session so `auth.uid()` is available inside RPCs and RLS policies.

**Implementation** — `supabase/functions/verify-pin/index.ts`:

The function is written in pure Deno using only `https://deno.land/std@0.224.0/http/server.ts` — no `supabase-js` import. The SDK was removed because the edge runtime container has no internet access and the `esm.sh` import triggered `@types/node` resolution that caused boot failures.

All Supabase operations are raw `fetch()` calls:

1. **PIN verification** — `POST /rest/v1/rpc/verify_player_pin_v2` (anon key)
   - Input: `{ input_pin, input_device_id, input_user_agent }`
   - Returns row with `player_id`, `is_new_device`, `trusted` (not `is_trusted`), `status`
   - Non-`ok` status → 401 with the status string as error code

2. **Role + email lookup** — `GET /rest/v1/players?id=eq.<player_id>&select=role,email` (service role)
   - Falls back to `player-<uuid>@padelobsters.internal` when email is null

3. **Auth user check** — `GET /auth/v1/admin/users/<player_id>` (service role)
   - 404 → create; anything else → update

4. **Create or sync auth user** — `POST /auth/v1/admin/users` or `PUT /auth/v1/admin/users/<id>` (service role)
   - Bakes `app_metadata: { role }` into the JWT on every login so the role claim stays current
   - Note: GoTrue v2 uses `PUT` for updates — `PATCH` returns 405

5. **Generate magic-link token** — `POST /auth/v1/admin/generate_link` with `{ type: 'magiclink', email }` (service role)
   - Returns `hashed_token` (not used as a link — used as a one-time exchange token)

6. **Exchange token for session** — `GET /auth/v1/verify?token=<hashed_token>&type=magiclink&redirect_to=<SUPABASE_URL>` with `redirect: 'manual'`
   - GoTrue returns 302; tokens are in the Location header URL fragment
   - Parse: `location.split('#')[1]` → `new URLSearchParams(fragment)` → `access_token`, `refresh_token`

**Response**: `{ access_token, refresh_token, role, is_new_device, is_trusted }`

The admin and league_admin paths collapse: there is no separate admin PIN step. The client calls the same Edge Function for everyone. The `role` field in the response tells the client what UI to show.

**AppContext changes** (login path simplified — Phase 5):

```javascript
// Before: 3 branches with different RPCs per role
// After: one call
const { data } = await supabase.functions.invoke('verify-pin', {
  body: { pin, device_id: deviceId },
})
if (data.access_token) {
  await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  // role comes from data.role (also baked into session as app_metadata.role)
}
```

The session persists via Supabase's own storage — no manual localStorage writes for admin/league_admin state.

**localStorage keys to remove** (after full migration):

- `lobster_admin`
- `lobster_session_admin_pin`
- `lobster_league_admin`

Keys that remain (or migrate to Supabase session):

- `lobster_claimed_id` → replaced by `auth.uid()`
- `lobster_device_id` → keep (device trust still needs it)
- `lobster_pending_id`, `lobster_pending_name` → keep until device trust is migrated

**Session role claim**: `role` is baked into `app_metadata` at every login in Step 4 of the Edge Function (`PUT /auth/v1/admin/users/<id>` with `{ app_metadata: { role } }`). The JWT carries it without a DB round-trip.

---

### Phase 3 — Role-Aware Authorization Helper ✅ Complete

**Goal**: replace `verify_admin_pin(input_admin_pin)` calls inside RPCs with a reusable identity check.

**DB function** — deployed in `supabase/migrations/20260512000002_rbac_phase3_require_admin.sql`:

```sql
create or replace function public.require_admin()
returns void language plpgsql as $$
begin
  if not exists (
    select 1 from public.players
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'unauthorized: admin required';
  end if;
end;
$$;
```

This function is the drop-in replacement for `if not public.verify_admin_pin(input_admin_pin) then return; end if;`.

---

### Phase 4 — Rewrite Admin & Player RPCs ✅ Complete

**Goal**: remove `input_admin_pin` and `input_pin` parameters from every PIN-gated RPC; replace with session-based authorization.

Shipped as four migrations:

- `20260512000003_rbac_phase4_admin_rpcs.sql` — admin RPCs rewritten with `perform public.require_admin();`
- `20260512000004_rbac_phase4_drop_old_overloads.sql` — drops the legacy PIN overloads (CREATE OR REPLACE only matches an exact signature, so the new + old signatures coexist until the old one is explicitly dropped)
- `20260512000005_rbac_phase4c_player_rpcs.sql` — player RPCs rewritten with `auth.uid()` (`approve_device`, `reject_device`, `list_pending_devices`, `get_my_profile_v2`, `update_my_profile`, `create_transfer`, `cancel_transfer`, `respond_to_transfer`, `get_transfer_recipient_phone`, `lobster_oscars_cast_vote`, `lobster_oscars_clear_vote`, `lobster_oscars_get_my_votes`)
- `20260512000006_rbac_phase4c_drop_old_overloads.sql` — drops the legacy player-PIN overloads

The change per RPC is mechanical:

```sql
-- Before (every admin RPC):
create or replace function admin_do_something(
  input_admin_pin text,   -- ← remove
  ...other params...
) returns ... language plpgsql security definer as $$
begin
  if not public.verify_admin_pin(input_admin_pin) then return; end if;  -- ← replace
  -- actual logic...
end;
$$;

-- After:
create or replace function admin_do_something(
  ...other params...     -- input_admin_pin removed
) returns ... language plpgsql security definer as $$
begin
  perform public.require_admin();  -- ← raises exception if not admin
  -- actual logic...
end;
$$;
```

**Client-side changes**: `adminPin` argument removed from every `supabase.rpc('admin_*', ...)` call in `AppContext.jsx`. Mirror change for player RPCs (`input_pin` / `input_device_id` / `input_user_agent` removed from every player-facing call site).

**Trade-off introduced**: Phase 4c also dropped the per-RPC `player_devices.trusted_at IS NOT NULL` guard. The migration comment ("an active Supabase session is the trust signal") is only half right — the session is only as trustworthy as the credential that minted it, and the credential is a 4-digit PIN. This is addressed in Phase 7.

**Rollout strategy**: deployed Phase 2 (session auth) and Phase 4 (RPC rewrite) as a single atomic migration + client deploy. The app is small, there are no external API consumers of these RPCs, and Vercel deploys are instant.

---

### Phase 5 — Simplify AppContext ✅ Complete

With Phase 2 and 4 complete:

**Removed from AppContext**:

- `loginWithPin` league_admin plaintext compare branch
- `loginWithPin` admin RPC call branch
- `verifyAdminPinLocally` / any inline admin PIN re-verification
- `adminPin` state and all refs to `lobster_session_admin_pin`
- `isLeagueAdmin` state and all refs to `lobster_league_admin`
- `isAdmin` boolean state — replace with session role

**Simplify role derivation**:

```javascript
// Before: derived from 3 separate boolean states
const role = isAdmin ? 'admin' : isLeagueAdmin ? 'league_admin' : claimedId ? 'player' : 'guest'

// After: derived from session
const session = await supabase.auth.getSession()
const role = session?.user?.app_metadata?.role ?? 'guest'
```

**Simplify Realtime auth**: player-specific subscriptions can use RLS with `auth.uid()` instead of manual filtering on `claimedId`.

**Cross-component sweep**: removing those exports from `AppContext`'s value object only fixes the provider — every consumer that destructured `isAdmin` / `isLeagueAdmin` / `claimedId` / `changeAdminPin` / `pendingClaim` / `claimIdentity` / `clearIdentity` / `checkMyDeviceTrust` / `acceptPendingClaim` / `cancelPendingClaim` would silently get `undefined`, breaking every role-gated branch at runtime. The fix is mechanical: each consumer derives `isAdmin = session?.user?.app_metadata?.role === 'admin'` and `claimedId = session?.user?.id ?? null` locally. Touched 13 components: `AuthGate`, `Dashboard`, `Game`, `History`, `League`, `Merch`, `Payments`, `Players`, `Registration`, `Schedule`, `Settings`, `Tournament`, `TransferAccept`, `TransferSpotModal`, `VerificationGate`, `AdminTransferPanel`. Two now-orphaned components were deleted: `ChangeAdminPinForm.jsx` (calls dropped `admin_change_pin` RPC) and `WaitingForApproval.jsx` (paired with the dropped `pendingClaim` flow).

The `league_admin` role was folded into `admin` — there's no separate league_admin signal in the session, so callers that previously branched on `isLeagueAdmin` either treat it as `false` (legacy badge code in `Tournament.jsx` is now dead-code) or collapse `canAdminLeague = isAdmin || isLeagueAdmin` to `canAdminLeague = isAdmin` (`League.jsx`).

---

### Phase 6 — Remove Shared PIN Machinery

Once Phase 4 and 5 are deployed and stable:

**DB**:

```sql
-- Remove shared-PIN functions
drop function if exists public.verify_admin_pin(text);
drop function if exists public.verify_admin_pin_v2(text, text, text);

-- Remove plaintext PIN column
alter table players drop column if exists pin;

-- These IF EXISTS guards are no-ops — these columns never existed on players.
-- Kept here for documentation completeness only; safe to run.
alter table players drop column if exists is_admin;
alter table players drop column if exists is_league_admin;
-- league_admin_pin never existed on settings either; also a no-op.
alter table settings drop column if exists league_admin_pin;
```

**AppContext**:

- Remove `isAdmin` and `isLeagueAdmin` boolean states entirely
- Remove `changeAdminPin` / `verifyAdminPin` functions
- Remove all references to `lobster_admin`, `lobster_session_admin_pin`, `lobster_league_admin` localStorage keys

---

### Phase 7 — Probationary Device Sessions (Read-Only by Default)

**Goal**: restore device-trust enforcement without bringing back the per-RPC PIN argument. Untrusted devices land in a session that can read everything but can't mutate state. An existing trusted device or admin promotes them; the next sign-in (or a silent re-mint) issues a trusted session.

**Why this is needed**: Phase 4c moved the trust signal from "every RPC checks `player_devices.trusted_at`" to "an active Supabase session is the trust signal". That implicitly weakened the model — `verify-pin` issues a session for any valid PIN regardless of device, and the new player RPCs only check `auth.uid() IS NOT NULL`. A stolen 4-digit PIN now grants full write access from any device. The `player_devices`, `auto_trust_until`, and approve/reject machinery is still in the schema, but nothing reads `trusted_at` for authorization. This phase fixes that.

**Trust signal**: bake `app_metadata.device_trusted: boolean` into the JWT on every login. Read it in RPCs the same way `app_metadata.role` is read for admin gating. Read-only access for everyone with a valid PIN; write access only for trusted devices.

**DB helper** — `public.require_trusted_device()`:

```sql
create or replace function public.require_trusted_device()
returns void language plpgsql as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'device_trusted')::boolean is not true then
    raise exception 'pending_device_approval' using errcode = 'P0001';
  end if;
end;
$$;
```

**Edge Function changes** (`supabase/functions/verify-pin/index.ts`):

- Already receives `is_trusted` from `verify_player_pin_v2`
- Bake `app_metadata: { role, device_trusted: is_trusted }` into the auth.users update before generating the link
- The session response shape stays compatible — `device_trusted` lives in the JWT's `app_metadata` claim, not the response body

**RPC gating** — add `perform public.require_trusted_device();` to every player RPC that mutates state:

- `update_my_profile`
- `create_transfer`, `respond_to_transfer`, `cancel_transfer`
- `lobster_oscars_cast_vote`, `lobster_oscars_clear_vote`

**Not gated** (intentional):

- `approve_device`, `reject_device` — these are the trust-elevation primitives a trusted device uses to approve a new one. Gating them on trust would deadlock the approval flow.
- `forgot_my_pin`, `get_my_profile_v2`, `list_pending_devices` — read-only or out-of-band.
- Admin RPCs — `require_admin()` already covers them. Admins are implicitly trusted (the role check is the stronger gate).

**Client UX**:

- A small ribbon at the top of the screen when `app_metadata.device_trusted === false` — "This device is read-only until approved. Open Padel Lobsters on a phone you've already used to approve it."
- Write actions (transfer button, vote button, profile-edit submit) check the JWT claim and either disable themselves or surface the ribbon's CTA
- Read surfaces (dashboard, players list, tournament browse, league standings, history) work unchanged

**Trust elevation flow**:

1. New device signs in → session has `device_trusted=false`
2. Existing trusted device or admin calls `approve_device` / `admin_approve_device` (already session-based, ungated by trust)
3. The new device's client polls a tiny `is_my_device_trusted()` RPC every ~30s while the ribbon is showing
4. On approval, the client silently calls `verify-pin` again (or shows a "Tap to refresh" pill) — re-running the Edge Function picks up the new `is_trusted` value from `player_devices.trusted_at` and mints a fresh JWT with `device_trusted=true`

**Auto-trust window** (`settings.auto_trust_until`) keeps working as-is. `verify_player_pin_v2` already auto-trusts the _first_ device for a player while the window is open; the Edge Function will see `is_trusted=true` and bake that into the JWT. New self-signups land in trusted sessions during onboarding without any code changes.

**Why not block at login (Option 1)**:

- Read-only access is more useful than a blocking "waiting for approval" screen — players can still browse upcoming events, see standings, and check whether anything is happening before bothering someone for approval
- Reuses standard Supabase session machinery instead of inventing a parallel "pending session" state
- The cost is per-RPC trust checks, but they're cheap (one JWT-claim read, no DB hit)

---

### Phase 8 — Enable RLS for Admin Operations (Optional / Future)

With `auth.uid()` available, some SECURITY DEFINER RPCs can be replaced with direct table operations guarded by RLS policies:

```sql
-- Example: admin can read all players
create policy "admin read all players" on players
  for select using (
    exists (select 1 from players where id = auth.uid() and role = 'admin')
  );
```

This is not required to complete the RBAC migration but is the natural follow-on that reduces SECURITY DEFINER surface area.

---

## Risk Summary

| Phase                           | Status      | Risk                                                                  | Mitigation                                                                                                                     |
| ------------------------------- | ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1 — role column                 | ✅ Complete | Low — additive only                                                   | Deployed solo, backfill verified                                                                                               |
| 2 — Supabase Auth               | ✅ Complete | Medium — new Edge Function, session handling                          | Tested in local Supabase; raw fetch avoids SDK boot issues                                                                     |
| 3 — helper function             | ✅ Complete | Low — new function, nothing calls it yet                              | Deployed solo                                                                                                                  |
| 4 — RPC rewrite                 | ✅ Complete | High — every admin & player RPC changed                               | Atomic deploy with Phase 5; verified end-to-end against local stack (admin path, player path, wrong PIN, RLS-equivalent gates) |
| 5 — AppContext + consumer sweep | ✅ Complete | Medium — login flow + 13-component fanout                             | Build + lint clean; manual browser smoke on Jon (admin) and Zornitsa (player)                                                  |
| 6 — remove columns              | ⏳ Pending  | Low — cleanup only                                                    | After confirming Phase 4/5 are stable in prod                                                                                  |
| 7 — probationary devices        | ⏳ Planned  | Medium — touches every player write RPC + reintroduces a trust ribbon | Ship behind a `device_trusted` claim that defaults `false`; stage rollout per-RPC; auto-trust window covers self-signup        |
| 8 — RLS for admin ops           | ⏳ Optional | Low — additive policies                                               | Replace one RPC at a time, verify behaviour before removing the SECURITY DEFINER variant                                       |

---

## What This Does Not Change

- **Player PIN format** — still 4-digit, still bcrypt. Only the session mechanism changes.
- **Device trust schema** — `player_devices`, `auto_trust_until`, the approve/reject machinery, and the rate-limiting in `verify_player_pin_v2` all stay. Phase 4c stopped _reading_ `trusted_at` for authorization, which weakened the trust model; Phase 7 puts that signal back via the JWT's `device_trusted` claim instead of a per-RPC table read.
- **Admin UI** — no feature changes. Admin-only screens still show for `role = 'admin'`; the role is just read from the session instead of localStorage.
- **Glicko-2, standings, all product features** — untouched.

---

## Implementation Order (Recommended)

```
Phase 1  →  Phase 3  →  Phase 2  →  Phase 4 + 5 (atomic)  →  [base quality work]  →  Phase 7  →  Phase 6  →  Phase 8 (optional)
```

Phase 3 before Phase 2 means the helper function exists before any RPC tries to call it. Phase 4 and 5 must be deployed together (RPC signature change + client change) or admin operations will break during the window between them. Phase 7 is sequenced before Phase 6 because the trust-claim work is independent of the legacy-PIN cleanup, and restoring the trust gate is more security-relevant than dropping the dead `verify_admin_pin*` functions. Phase 8 is opportunistic and stays optional.
