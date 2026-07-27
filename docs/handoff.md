# Code-hygiene sweep — handoff

State as of 2026-07-27, branch `clean-code-26-07`, **28 commits, nothing pushed**.
Delete this file when the remaining work is done.

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
| Tests             | 729             | 1016                             |
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

---

## Remaining work

Open tasks are in the task list (#15–#18, #20). Ordered by value:

1. **#16 — SECURITY, needs owner go-ahead.**
   `20260518000007_...:5` does `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
FROM anon, authenticated` — which leaves Postgres's default **PUBLIC** grant
   intact, so the lockdown never took effect. `has_function_privilege('anon', …)`
   is true for `admin_add_player`, `admin_regenerate_pin`,
   `get_all_players_with_pii_v2`. Defence-in-depth failure, not a confirmed leak
   (those RPCs call `require_admin()` internally). Fix needs
   `REVOKE … FROM PUBLIC` plus explicit re-grants, checked function by function —
   four functions are intentionally anon-callable (`verify_player_pin_v2`,
   `self_signup_player`, `forgot_my_pin`, `is_my_device_trusted`).

2. **#17 + #18 — swallowed errors, ~15 sites.** Eleven-plus instances of
   swallow-and-continue were found across the sweep; these are what remain.
   Widest: `useRegistrations.ts:52` has a bare `catch {}`, so every payment-status
   write in `Registration.tsx` and `Payments.tsx` silently no-ops while the UI
   shows the old value. Also `Dashboard` reads `data` from eight hooks and checks
   `isError` on none — a failed `useTournaments` renders "No upcoming events
   right now" with a Create Event button. **These want one project-wide
   convention for surfacing failures, not fifteen ad-hoc fixes.** That is a
   design decision for the owner.

3. **#20 — `leagues.status` migration.** No CHECK constraint, and the column
   default `'signups_open'` is not in the app's `LeagueStatus` union, so
   `PHASE_PILL[status]` would throw on such a row. Latent because
   `admin_create_league` hardcodes `'draft'`. Maps are keyed by `string` as a
   stopgap.

4. **#15 — design-system phase 3.** Backlog with evidence in the task. Most
   valuable item is not cosmetic: **12 of 14 hand-rolled bottom sheets lack the
   body-scroll-lock and drag-to-close that `ui/Modal` provides** — a real mobile
   UX defect. Also `CollapsibleCard`, `StatTile`, `ProgressBar`, `ConfirmDialog`
   (14 `window.confirm` calls), and ~650 remaining `text-gray-*`.

5. **Not scheduled:** `src/features/settings/`, `src/features/oscars/` and
   `src/components/` are still JS/JSX (~43 files). They were never in scope.
   `PlayerForm.tsx`/`SignupRequest.jsx` are a copy-paste pair worth extracting.

## Owner action items (blocking)

- **Push `supabase/migrations/20260726234531_remove_pii_dump_quota.sql` to
  production.** Commit `eb14e5e` depends on it: the community conversion slices
  the PII fetch, and under the old 3-reads/24h cap an admin would get an empty
  roster. Manual `npx supabase db push` from `main`.
- **Visual pass over the design-system changes** in the running app. 21 controls
  changed token (`bg-gray-100` → `bg-lob-teal-light`), five avatars now show
  photos where they showed letters, `TeamPage` markers went two letters → one,
  and oscars error banners are coral rather than red. No test can tell you
  whether that looks right.
- Decide #16 and the #17/#18 error convention.

## Landmines — do not trip these

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
