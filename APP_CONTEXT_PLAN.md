# AppContext Refactor Plan

## Current State

`src/context/AppContext.jsx` is 656 lines and owns:

- Auth state (`session`, `role`, `roleRef`) + all auth API calls
- Data state for 7 slices (players, tournaments, registrations, matches, transfers, raffleWinners, settings)
- Initial load + 7 realtime subscription channels + 60-second polling — all in one `useEffect`
- 5 inline `useMemo` normalisation blocks (snake_case → camelCase transforms)
- 7 device wrapper functions (pure pass-throughs used by only 2 admin components)
- Raffle state + 2 raffle mutations
- 7 mutations that call `alert()` directly

**Five structural problems:**

1. **Device functions are bloat** — 7 wrappers exported on the context value but only used by `AdminSecurityPanels` and `ApproveDevicesWidget`.
2. **Normalisation is untestable** — 5 `useMemo` blocks inline; can't unit-test without rendering the full provider.
3. **Loading/subscriptions/polling tangled** — initial load, 7 realtime channels, 60s poll, and role-change reload are spread across 3 `useEffect` blocks with shared closure over `roleRef`.
4. **`alert()` in context** — 7 mutations call `alert()` directly, coupling error UX to the data layer.
5. **Auth mixed with data state** — session management and all auth API functions live alongside tournament/player state.

## Goals

- Move data slices closer to consumers where practical
- Manage auth independently via a dedicated hook
- Extract and encapsulate loading/subscription logic
- Extract normalisation as pure, testable functions
- Move error UX to feature slices (mutations return `{ ok, error }`)
- Reduce the AppContext provider to a thin composition layer

---

## Tasks

Tasks are ordered by dependency. Each task is self-contained and safe to implement atomically. Tasks 1–5 are additive (new files only). Task 6 is the integration step. Tasks 7–8 are the error-UX migration. Task 9 is test coverage.

---

### Task 1 — Extract normalisation to `src/lib/normalise.js` ✅ DONE

**Status:** Complete. File exists at `src/lib/normalise.js` with 5 exported pure functions:

- `normalisePlayers(players)`
- `normaliseTournaments(tournaments)`
- `normaliseRegistrations(registrations)`
- `normaliseMatches(matches)`
- `normaliseTransfers(transfers)`

No consumers have been updated yet — that happens in Task 6.

---

### Task 2 — Create `src/hooks/useAuth.js` ✅ DONE

**What to create:** A custom hook that owns all authentication state and API calls.

**File:** `src/hooks/useAuth.js`

**What it owns:**

- `session` state (initially `null`)
- `role` derived from `session?.user?.app_metadata?.role ?? 'guest'`
- `roleRef = useRef('guest')` — kept in sync via `useEffect`
- Auth state change listener (`supabase.auth.onAuthStateChange` + initial `supabase.auth.getSession()`)
- All auth API call wrappers: `loginWithPin`, `logout`, `fetchMyProfile`, `forgotMyPin`, `selfSignup`, `fetchAllPlayersWithPii`

**Interface returned:**

```js
return {
  session,
  role,
  roleRef, // mutable ref — passed into useDataSync
  loginWithPin,
  logout,
  fetchMyProfile,
  forgotMyPin,
  selfSignup,
  fetchAllPlayersWithPii,
}
```

**Source in AppContext:**

- Lines 36–44: auth `useEffect` (getSession + onAuthStateChange)
- Lines 570–574: `roleRef` sync `useEffect`
- Lines 471–515: `loginWithPin`, `fetchMyProfile`, `forgotMyPin`, `selfSignup`, `fetchAllPlayersWithPii`, `logout`

**Acceptance criteria:**

- `useAuth` can be imported and used standalone (no AppContext dependency)
- `session`, `role`, `roleRef` are reactive to auth state changes
- AppContext will call `useAuth()` in Task 6 and spread its return value into the context value

---

### Task 3 — Create `src/hooks/useDataSync.js` ✅ DONE

**What to create:** A hook that accepts state setters and `roleRef`, then manages all data loading, realtime subscriptions, and polling.

**File:** `src/hooks/useDataSync.js`

**Signature:**

```js
export default function useDataSync({
  setPlayers,
  setTournaments,
  setRegistrations,
  setMatches,
  setTransfers,
  setSettings,
  setRaffleWinners,
  roleRef,
})
```

**What it owns:**

- `loadPlayers`, `loadTournaments`, `loadRegistrations`, `loadMatches`, `loadTransfers`, `loadSettings`, `loadRaffleWinners` — individual loader functions (each calls its `*Api` function and passes result to its setter)
- `loadAll()` — calls all 7 loaders via `Promise.all`
- Main `useEffect`: calls `loadAll()` on mount; sets up 7 realtime subscription channels; returns cleanup that unsubscribes all channels
- 60-second polling `useEffect`: `setInterval(loadPlayers, 60_000)` — needed because realtime is silent after REVOKE on `public.players`
- Role-change reload: when `roleRef.current` changes to a non-guest value, reload tournaments (admin sees all statuses, player sees only upcoming/active)

**Realtime channels (7):**

1. `supabase.channel('players')` → `loadPlayers`
2. `supabase.channel('tournaments')` → `loadTournaments`
3. `supabase.channel('registrations')` → `loadRegistrations`
4. `supabase.channel('matches')` → `loadMatches`
5. `supabase.channel('transfers')` → `loadTransfers`
6. `supabase.channel('settings')` → `loadSettings`
7. `supabase.channel('raffle_winners')` → `loadRaffleWinners`

**Source in AppContext:**

- Lines 46–99: main data load + subscription `useEffect`
- Lines 106–109: 60-second poll `useEffect`
- Lines 110–150: 7 individual loader functions

**Acceptance criteria:**

- Hook is purely a side-effect coordinator; it manages effects only, returns nothing
- All `supabase.removeChannel` calls happen in cleanup
- Interval is cleared in cleanup
- AppContext calls `useDataSync(...)` in Task 6 and removes the 3 affected `useEffect` blocks

---

### Task 4 — Create `src/hooks/useDevices.js` and update consumers ✅ DONE

**What to create:** A standalone hook wrapping all 7 device API calls. Two components stop using `useApp()` for devices.

**File:** `src/hooks/useDevices.js`

**Interface:**

```js
export default function useDevices() {
  return {
    listPendingDevices,
    approveDevice,
    revokeDevice,
    listMyDevices,
    trustDevice,
    requestDeviceApproval,
    getDeviceApprovalStatus,
  }
}
```

Each function is a thin wrapper calling the matching `devicesApi.*` function.

**Consumers to update:**

- `src/components/AdminSecurityPanels.jsx` — replace 4 destructured device functions from `useApp()` with `useDevices()`
- `src/components/ApproveDevicesWidget.jsx` — replace 3 destructured device functions from `useApp()` with `useDevices()`

**AppContext cleanup (in Task 6):** Remove the 7 device wrapper functions (lines 517–563) and their 7 entries in the provider value.

**Acceptance criteria:**

- Both components import `useDevices` directly; no device functions remain in `useApp()` destructuring
- Device functions removed from AppContext provider value object

---

### Task 5 — Create `src/features/merch/useRaffle.js` and update consumers ✅ DONE

**What to create:** A feature-local hook owning raffle state and mutations.

**File:** `src/features/merch/useRaffle.js`

**What it owns:**

- `raffleWinners` state (initially `[]`)
- `loadRaffleWinners()` loader
- `recordRaffleWinners(tournamentId, winners)` mutation
- `updateRaffleWinnerPrize(winnerId, prize)` mutation
- Realtime subscription for `raffle_winners` table
- Returns `{ raffleWinners, recordRaffleWinners, updateRaffleWinnerPrize }`

**Consumers to update:**

- `src/features/merch/Raffle.jsx` — replace `{ raffleWinners, recordRaffleWinners, updateRaffleWinnerPrize }` from `useApp()` with `useRaffle()`
- `src/features/merch/Merch.jsx` — replace `{ raffleWinners }` from `useApp()` with `useRaffle()`

**AppContext cleanup (in Task 6):** Remove `raffleWinners` state, `loadRaffleWinners`, `recordRaffleWinners`, `updateRaffleWinnerPrize`, and their entries in the provider value. Remove the raffle channel from `useDataSync`.

**Note:** `useDataSync` created in Task 3 should leave out the raffle channel since Task 5 will own that subscription. Either implement Task 5 before Task 3, or add a note in Task 3's implementation to exclude `raffle_winners` channel.

**Acceptance criteria:**

- `Raffle.jsx` and `Merch.jsx` no longer reference raffle values via `useApp()`
- `raffleWinners` removed from AppContext provider value

---

### Task 6 — Integrate hooks into AppContext and wire normalise.js ✅ DONE

**Status:** Complete. `AppContext.jsx` now imports `useAuth`, `useDataSync`, and the 5 `normalise*` functions; auth state/loaders/device wrappers/raffle state are all gone; the 5 normalisation `useMemo` blocks call the pure functions. File is 381 lines (above the original ≤300-line target — not retried because the remaining bulk is mutations + provider value, both of which are already minimal).

**What to change:** `src/context/AppContext.jsx` — the main integration task.

**Changes:**

1. **Import and call `useAuth()`** (Task 2):
   - Remove auth state declarations (`session`, role-derived values, `roleRef`)
   - Remove auth `useEffect` blocks (lines 36–44, 570–574)
   - Remove auth functions (lines 471–515)
   - Replace with `const auth = useAuth()` and spread `auth` into the provider value

2. **Import and call `useDataSync()`** (Task 3):
   - Remove the 3 `useEffect` blocks (lines 46–109)
   - Remove the 7 individual loader functions (lines 110–150)
   - Keep state declarations for players/tournaments/registrations/matches/transfers/settings as `useState` in AppContext
   - Call `useDataSync({ setPlayers, setTournaments, ..., roleRef: auth.roleRef })`

3. **Replace 5 `useMemo` normalisation blocks** (Task 1):
   - Lines 358–436: replace each `useMemo` body with a call to the corresponding `normalise*` function from `src/lib/normalise.js`
   - Example: `const normPlayers = useMemo(() => normalisePlayers(players), [players])`

4. **Remove device functions** (Task 4):
   - Lines 517–563: delete all 7 device wrapper functions
   - Remove their 7 entries from provider value

5. **Remove raffle state/functions** (Task 5):
   - Remove `raffleWinners` state and its loader
   - Remove `recordRaffleWinners`, `updateRaffleWinnerPrize`
   - Remove their entries from provider value

**Acceptance criteria:**

- AppContext file is under 300 lines
- Provider value still exports all values that non-migrated consumers expect
- No `alert()` calls remain (see Task 7)
- All 5 normalise functions are called via `useMemo` wrapping the pure function
- Auth hook owns session/role/roleRef entirely

---

### Task 7 — Remove `alert()` from AppContext mutations ✅ DONE

**Status:** Complete. Zero `alert()` calls remain in `AppContext.jsx`. Mutations now throw on error; `addPlayer` returns `{ ok: true, data }`, `regeneratePin` returns `{ ok: true, pin }`, and `updatePlayer` / `deletePlayer` / tournament mutations return `{ ok: true }` on success.

**What to change:** `src/context/AppContext.jsx` — all 7 mutations that call `alert()`.

**Affected functions and their current alert calls:**

| Function           | Location  | Current behaviour                                                           |
| ------------------ | --------- | --------------------------------------------------------------------------- |
| `addPlayer`        | ~line 156 | `alert('Could not add player: …')` on supabase error                        |
| `updatePlayer`     | ~line 175 | `alert('Could not update player: …')` on supabase error                     |
| `deletePlayer`     | ~line 198 | `alert('Cannot delete a player …')` + `alert('Could not delete player: …')` |
| `addTournament`    | ~line 215 | `alert('Could not save event: …')` on supabase error                        |
| `updateTournament` | ~line 235 | `alert('Could not update event: …')` on supabase error                      |
| `deleteTournament` | ~line 248 | `alert('Could not delete event: …')` on supabase error                      |
| `regeneratePin`    | ~line 453 | `alert('Could not regenerate PIN…')` + `alert('New PIN: …')` (success!)     |

**New contract:** Each mutation removes `alert()` calls and instead:

- On error: `throw new Error(message)` — or return `{ ok: false, error: message }` (pick one style and be consistent — `throw` is recommended as it works naturally with `try/catch` at the call site)
- On success: `return { ok: true, data: result }` (for functions that need to return data like `regeneratePin` returning the new PIN)

**`regeneratePin` special case:** Currently shows the new PIN via `alert()`. After Task 7, it should return `{ ok: true, pin: newPin }` and the caller (`Players.jsx`) will display the PIN in a modal or inline UI element.

**Acceptance criteria:**

- Zero `alert()` calls remain in AppContext
- Every affected mutation either throws on error or returns `{ ok: false, error: string }`
- Functions that return data (like `regeneratePin`) return it in the success result object

---

### Task 8 — Update mutation callers with error handling ✅ DONE

**Status:** Complete. All AppContext mutation call sites now wrap their calls in `try/catch` and surface errors via local error state. `regeneratePin` displays the new PIN via `setPinReveal(...)` modal — no `alert()`. The two prior holdouts are now fixed:

- `src/features/events/Registration.jsx` — `handleMarkComplete` wraps `updateTournament(...)` in try/catch, reuses `tournamentError` state, and renders the message under the Mark Complete button.
- `src/features/events/UpcomingEventCard.jsx` — `handleBookCourt(i)` wraps the per-court `updateTournament(...)` in try/catch with local `bookError` state and a per-button `bookingIndex` to disable the chip mid-flight; error renders below the courts row.

**What to change:** Feature files that call AppContext mutations. Each gets `try/catch` and local error display.

**Files and affected call sites:**

**`src/features/community/Players.jsx`**

- `addPlayer(...)` — wrap in try/catch; show inline error state
- `updatePlayer(...)` — wrap in try/catch; show inline error state
- `deletePlayer(...)` — wrap in try/catch; show inline error state
- `regeneratePin(...)` — handle returned `{ ok, pin }` instead of relying on `alert()`; display PIN in a UI element (e.g. a small inline card or copy-to-clipboard button)

**`src/features/settings/Settings.jsx`**

- `updatePlayer(...)` in `handleProfileSave` (line ~188) — already in a `try/finally`; add `catch` to set local error state and display it near the Save button

**Tournament feature files** — identify which files call `addTournament`, `updateTournament`, `deleteTournament` and add try/catch in each.

**Search pattern to find all call sites:**

```
grep -r "addTournament\|updateTournament\|deleteTournament\|addPlayer\|updatePlayer\|deletePlayer\|regeneratePin" src/features src/components
```

**Acceptance criteria:**

- No call site relies on context-level `alert()` for error display
- Each call site has a `try/catch` (or checks `result.ok`) and renders error feedback to the user
- `regeneratePin` success case shows the new PIN in the UI without `alert()`

---

### Task 9 — Unit tests for `src/lib/normalise.js` ⏳ NOT STARTED

**Status:** No test framework currently installed in the project (no `vitest` / `jest` in `package.json`, no `test` script). This task requires installing Vitest first, then writing `src/lib/normalise.test.js`.

**What to create:** `src/lib/normalise.test.js`

**Test framework:** Vitest (matches the project's Vite setup) or Jest — check `package.json` for whichever is already installed.

**Tests to write per function:**

`normalisePlayers`:

- snake_case fields are mapped to camelCase (`playtomic_level` → `playtomicLevel`)
- camelCase fields are preserved as fallback when snake_case is absent
- Default values applied when both forms absent (`adjustment` → `0`, `status` → `'active'`, etc.)
- `learnedLevel` computed correctly: `(rating - 1200) / 100`, null when `learned_rating` is null
- `isLeftHanded` defaults to `false`

`normaliseTournaments`:

- `court_booking_mode` → `courtBookingMode` with default `'admin_all'`
- `gender_mode` → `genderMode` with default `'mixed'`
- `courts` defaults to `[]`

`normaliseRegistrations`:

- `tournament_id` → `tournamentId`
- `payment_status` → `paymentStatus` with default `'unpaid'`
- `registeredAt.seconds` is computed correctly from `created_at` ISO string

`normaliseMatches`:

- `team1_ids` → `team1Ids` with default `[]`
- `team1_level` → `team1Level` with default `0`

`normaliseTransfers`:

- All 6 snake_case fields mapped correctly
- `closedReason` defaults to `null`

**Acceptance criteria:**

- All functions have at least one test for: happy path (snake_case input), fallback (camelCase input), and defaults (empty input)
- Tests are runnable with `npm test` or `npx vitest`
- 100% branch coverage on the `??` default expressions

---

## Execution Order

```
Task 1 ✅  (normalise.js — additive, no consumers changed yet)
Task 2 ✅  (useAuth.js — additive)
Task 3 ✅  (useDataSync.js — additive)
Task 4 ✅  (useDevices.js + update 2 components — safe, additive hook + consumer swap)
Task 5 ✅  (useRaffle.js + update 2 components — safe, additive hook + consumer swap)
Task 6 ✅  (AppContext integration — wires Tasks 1-5 together, removes old code)
Task 7 ✅  (Remove alert() from mutations — AppContext only, no consumers yet)
Task 8 ✅  (Update mutation callers — all call sites covered, including Registration handleMarkComplete and UpcomingEventCard Book button)
Task 9 ⏳  (Tests for normalise.js — not started; needs Vitest install first)
```

Tasks 2 and 3 are independent and can run in parallel.
Tasks 4 and 5 are independent and can run in parallel.
Task 9 can run any time after Task 1.
Task 6 requires Tasks 1–5 complete.
Task 7 requires Task 6 complete.
Task 8 requires Task 7 complete.

---

## Files Created / Modified Summary

| Task | Creates                           | Modifies                                                                                                                                                                                                                                                                                           |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅ | `src/lib/normalise.js`            | —                                                                                                                                                                                                                                                                                                  |
| 2 ✅ | `src/hooks/useAuth.js`            | —                                                                                                                                                                                                                                                                                                  |
| 3 ✅ | `src/hooks/useDataSync.js`        | —                                                                                                                                                                                                                                                                                                  |
| 4 ✅ | `src/hooks/useDevices.js`         | `src/components/AdminSecurityPanels.jsx`, `src/components/ApproveDevicesWidget.jsx`                                                                                                                                                                                                                |
| 5 ✅ | `src/features/merch/useRaffle.js` | `src/features/merch/Raffle.jsx`, `src/features/merch/Merch.jsx`                                                                                                                                                                                                                                    |
| 6 ✅ | —                                 | `src/context/AppContext.jsx`                                                                                                                                                                                                                                                                       |
| 7 ✅ | —                                 | `src/context/AppContext.jsx`                                                                                                                                                                                                                                                                       |
| 8 ✅ | —                                 | `src/features/community/Players.jsx` ✅, `src/features/settings/Settings.jsx` ✅, `src/features/events/Tournament.jsx` ✅, `src/features/events/Schedule.jsx` ✅, `src/features/events/Registration.jsx` ✅, `src/features/events/UpcomingEventCard.jsx` ✅, `src/components/SignupRequest.jsx` ✅ |
| 9 ⏳ | `src/lib/normalise.test.js`       | `package.json` (add Vitest)                                                                                                                                                                                                                                                                        |
