# Code-hygiene sweep — handoff

State as of 2026-07-27 (second session), branch `clean-code-26-07`,
**33 commits, nothing pushed**. Delete this file when the remaining work is
done.

Companion docs: `docs/conversions.md` (the conversion playbook — read it, it
carries hard-won process rules), `ARCHITECTURE.md`, `CLAUDE.md`.

---

## How this work is run

**Opus coordinator + delegated workers.** The coordinator owns sequencing,
decisions and all git operations; workers do scoped implementation and report
back. This is deliberate and should continue.

Rules that came from things going wrong — do not relax them:

- **Workers never commit.** They leave changes in the working tree and report.
  The coordinator verifies independently, then stages narrowly and commits.
- **Verify worker claims rather than trusting them.** Multiple reports this
  session were wrong in consequential ways: a worker asserted `Schedule.jsx`'s
  preview block was dead (it is live); another reported a lint baseline that was
  inflated by its own untracked files, hiding 8 added `any`s. Both were caught
  by re-measuring.
- **One worker at a time on any shared directory.** Two ran concurrently on
  2026-07-27 and collided. File-level scopes being disjoint is _not_ sufficient
  if both touch git state.
- **Never `git stash` on a shared tree, never `git add -A`.** Stage explicit
  paths. Both rules exist because the coordinator broke them once each.
- Give workers the owner's policy verbatim when it applies (see below).

## Owner's standing decisions

- **Prefer fixing over casting.** "The goal is improving baseline quality and
  catching real issues to fix, not hiding them." No `as any`, no
  `as unknown as X`, no `@ts-expect-error`, no `eslint-disable` to silence.
  A justified remainder beats a clean number achieved by hiding.
- **Generated Supabase types and Zod are complementary**, not alternatives.
  Generated types are compile-time; Zod stays as the runtime boundary parse.
- Types are generated from the **local** stack (it replays all migrations),
  never from production.
- Delivery is **stacked commits on `clean-code-26-07`**, not one PR per item.
- Defer to the owner on anything ambiguous or product-shaped.

---

## What was done

All four original goals are complete: TypeScript conversion, design-system
extraction, test review, and data slices with strong types.

| Metric            | Start           | Now                              |
| ----------------- | --------------- | -------------------------------- |
| Tests             | 729             | 1047                             |
| Lint              | 139 warnings    | 64 warnings, 0 errors (gates CI) |
| `no-explicit-any` | 68              | 0 — rule is now `error`          |
| TypeScript        | `strict: false` | `strict: true`                   |
| TS share of `src` | 57%             | 85%                              |
| Supabase client   | untyped         | `createClient<Database>`         |
| Net               | —               | 246 files, +12099 / −16914       |

Highlights: deleted the dead V1 matcher (~1,460 LOC, Schedule chunk −19% gzip)
and the V1 rating write path; golden snapshot 14,251 → 4,144 lines and now
asserts `violations: []`; five features converted to TS with their un-sliced
fetches moved into the slice that owns the table; `src/components/ui/` grew from
14 to 19 components.

### Real bugs found and fixed

- `acceptMerge` wrote an **empty name** to the player record (form set `name`
  but not `firstName`/`lastName`, which is what the submit path reads).
- `Schedule.tsx` fed unvalidated team arrays and a nullable `round` into the
  ratings engine; `MatchResult` requires a 2-tuple and a positive int.
- The payment sheet's "only upgrade from unpaid" guard always saw `undefined`
  (registration status passed into a field read as payment status) — it worked
  by luck.
- `AdminTools`' new-orders badge read `.length` off a `head: true` response, so
  it was always 0 and had never rendered.
- `Dashboard` and `useCountdown` disagreed by an hour on a bare `"20"` event
  time.
- `leagues.divisions` is nullable and every reader dereferenced it.
- History counted half-scored matches; the event page did not.
- `leagues.status` had a live production row (`signups_open`) outside the app's
  union, and both `LeagueHome` and `LeagueDashboardCard` destructured the
  status→badge lookup unguarded, so it rendered a TypeError rather than a badge.

### Second session (2026-07-27): #16, #17/#18, #20 closed

- **#16** (`dfb11b1`) — the grant leak was **47 functions, not the 3 recorded
  here**. Still defence-in-depth: 36 call `require_admin()` internally and 5
  are trigger functions Postgres won't invoke directly. One real gap closed —
  `is_my_device_trusted` is SECURITY DEFINER, takes an arbitrary
  `input_player_id` with no check that it belongs to the caller, and was
  anon-granted.
- **#17/#18** (`815fa6c`, `18d01c0`) — toast system + `MutationCache.onError`,
  then the paths the global handler can't see. All remaining bare `catch {}`
  in `src/` were audited and are legitimate (browser-API guards, date
  fallbacks, a clipboard write whose failure is harmless).
- **#20** (`6c3ac87`) — CHECK constraint plus a `statusPill` helper making both
  lookups total.
- **#15 bottom sheets** (`a18d87f`) — ten of twelve migrated to `ui/Modal`.
  `RematchFixPanel` and `AuthGate`'s `PinPrompt` deliberately left alone;
  their contracts genuinely differ (see the commit). `Modal` gained a
  `dismissible` prop so long forms can't be dismissed by a mis-tap.
- **#15 `ConfirmDialog`** (`8a2e2bb`) — all 17 blocking `confirm()` calls
  replaced with a promise-based dialog built on `ui/Modal`.

### Corrections to what this file used to say

Three claims here were wrong and cost time to disprove — they are fixed above,
recorded so nobody reinstates them:

- **`forgot_my_pin` does not exist.** Dropped in `20260528000000`. It was
  listed as intentionally anon-callable. Do not write a grant for it.
- **`leagues.status`'s default was already fixed.** `20260523000001:38` changed
  it from `'signups_open'` to `'draft'` long ago. The real problem was the
  pre-existing _row_, not the default.
- **The #16 blast radius was understated** — 3 functions listed, 47 actual.

---

## Remaining work

The 2026-07-27 session closed #16, #17/#18, #20, and both the bottom sheets
and `ConfirmDialog` from #15 — see "What was done". What is left:

1. **#15 — three display components not yet extracted:** `CollapsibleCard`,
   `StatTile`, `ProgressBar`. Find the duplicated markup before designing the
   props; do not invent an API from the names alone.

2. **#15 — the `text-gray-*` token sweep.** Measured: **633 occurrences across
   90 files** (the "~650" previously recorded is accurate). Mechanical, but it
   is the single largest source of visual risk left, and it cannot be verified
   by any test. **Do it in one pass, immediately before a visual review**, not
   interleaved with behavioural work — otherwise a regression it causes gets
   attributed to whatever else shipped alongside it.

3. **TypeScript conversion of `src/features/settings/`, `src/features/oscars/`
   and `src/components/`** (~43 files). Never in scope originally; now the last
   big untyped surface. `PlayerForm.tsx`/`SignupRequest.jsx` are a copy-paste
   pair worth extracting. Follow `docs/conversions.md`.

**Sequencing note:** the visual-review debt is now substantial — the design
system changes from the first session, plus (second session) the toast
component, ten migrated bottom sheets, and 17 replaced confirm dialogs.
Getting a visual pass done before starting the `text-gray-*` sweep will make
any regression far cheaper to attribute.

## Owner action items (blocking)

- **Push three migrations to production** — manual `npx supabase db push` from
  `main`. They go together; read the notes before running it:
  - `20260726234531_remove_pii_dump_quota.sql` — commit `eb14e5e` depends on
    it; without it an admin gets an empty roster under the old 3-reads/24h cap.
  - `20260727195327_league_status_check_constraint.sql` — **this one DELETES
    production data** (one stale league plus 3 cascading `league_interests`
    signups), unlike everything else on this branch. Confirmed, but push it
    knowingly.
  - `20260727194010_lock_down_function_grants.sql` is additive and safe, but
    it narrows who can call what. If an RPC starts returning "permission
    denied for function" after deploy, the allowlist missed a caller — the fix
    is a grant, not a revert.
- **Visual pass over the design-system changes** in the running app. 21
  controls changed token (`bg-gray-100` → `bg-lob-teal-light`), five avatars
  now show photos where they showed letters, `TeamPage` markers went two
  letters → one, oscars error banners are coral rather than red. Also new:
  the toast component (`src/components/ui/Toast.tsx`) has never been seen on a
  real device — check it clears the bottom nav and reads well over content.
  No test can tell you whether any of that looks right.

## Landmines — do not trip these

- **Never commit while a worker is mid-flight.** The `lint-staged` pre-commit
  hook runs `git stash` to back up unstaged changes. With a worker editing the
  tree, that stashes its in-progress work. This is the documented
  two-workers-collided failure arriving by a different route — the coordinator
  is not exempt from it just because only one worker is running.
- **`ALTER DEFAULT PRIVILEGES` does not lock down functions on this stack.**
  It was tried in `20260727194010` and removed. The `pg_default_acl` row stores
  correctly without PUBLIC, yet functions created afterwards still come out
  with `=X` (PUBLIC EXECUTE); no event trigger explains it. It also cuts
  against Supabase, which ships its own default ACL granting
  anon/authenticated on `public` functions — that model expects
  `SECURITY DEFINER` plus an internal check. Regression protection is
  `npm run db:grants:check` in CI, and that is deliberate, not a shortcut.
- **`verify_player_pin_v2` must keep its `anon` grant.** Nothing in the browser
  calls it, so it reads as droppable. The `verify-pin` Edge Function calls it
  with the **anon** key (`supabase/functions/verify-pin/index.ts:75`,
  `anonHeaders`), so removing the grant breaks every PIN login.
- **`supabase/expected_function_grants.txt` is a deliberate allowlist.** When
  `db:grants:check` fails, read the diff before regenerating — `npm run
db:grants` will happily bless a leak. A new function that should not be
  client-callable needs `REVOKE ... FROM PUBLIC` in the migration creating it.

- **`Schedule.tsx`'s `generated` preview/save block is LIVE.** After the V1
  matcher deletion it reads as unreachable. It is not: `handleEditSchedule`
  (~:87) sets `generated` from `savedRounds` for admins and enables swap mode,
  which drives the manual swap, the save, and the `validateSchedule` call
  (~:141, 32 tests). One worker already asserted this was dead and was wrong.
  Recorded in `docs/matchmaking-v2/PLAN.md` §M4.3.
- **`Schedule.tsx`'s two swap-selected avatar circles** take `bg-orange-500`
  overriding `letterColor`; `Avatar` sets `backgroundColor` inline so a class
  cannot win. Deliberately left outside `Avatar`.
- **Do not hand-edit `src/lib/database.types.ts`.** Change a migration and run
  `npm run db:types`. `npm run db:types:check` gates it, and a path-filtered CI
  workflow runs it when migrations change.
- **`docs/matchmaking-v2/` and `ARCHITECTURE.md` contain deliberate historical
  references** to deleted files, describing them as deleted. Do not "clean up"
  the record of why code went away.
- **Step 0 grep must match `supabase` bare, not `supabase\.`** — chained calls
  break the line before the dot. That flaw hid a direct fetch once already.
- `aliasStorage.ts`'s writers and `data/leagueContent.ts` are orphaned but
  deliberately kept; the "PIN reset N×" badge has never rendered. All recorded
  in `ARCHITECTURE.md` Open Work as product questions.
