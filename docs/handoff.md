# Code-hygiene sweep — handoff

State as of 2026-07-28 (third session), branch `clean-code-26-07`,
**45 commits, nothing pushed**. All planned work is complete; what is left is
the owner's, listed under "Owner action items". Delete this file once those
are done.

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
| Tests             | 729             | 1175                             |
| Lint              | 139 warnings    | 61 warnings, 0 errors (gates CI) |
| `no-explicit-any` | 68              | 0 — rule is now `error`          |
| TypeScript        | `strict: false` | `strict: true`                   |
| TS share of `src` | 57%             | 99% (only api/hooks/lib/data)    |
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

### Third session (2026-07-28): #15 closed, TypeScript conversion finished

- **Three display components** (`fbbef35`) — `ProgressBar` (6 sites),
  `StatTile` (13 tiles across 4 files, incl. `TeamPage`'s local `StatCell`),
  `CollapsibleCard` (4 of 8 chevron disclosures). Each API was derived from
  the measured duplication, not from the component name. `ProfileSection` was
  correctly refused: an always-visible summary sits between its toggle button
  and its collapsed block, so `CollapsibleCard` does not fit it.
- **`src/features/settings/`** (`e6787f6`) — 7 files. Its hand-rolled
  `supabase.storage` avatar upload moved to the players slice's
  `useAvatarUpload`, which already anticipated this caller in a comment.
- **`src/features/oscars/`** (`a205b47`) — 11 files, and the session's real
  find. `useOscarsSession.js` had 8 direct fetchers; three re-read tables
  another surface already cached. **Live bug:** an admin pressing Share
  updated only the local `useState` copy, so `oscarKeys.session(id)` stayed
  stale and the registration results banner did not flip until `staleTime`
  expired. Session row, shared results and matches now go through their
  owning slices, reusing existing keys.
- **`src/components/`** (`e7aabde`) — 15 files, the last untyped surface.
  `Layout`'s `is_my_device_trusted` RPC was found only because the Step 0
  grep matches `supabase` **bare** — the call chains across a line break.
- **`fix(layout)`** (`3915716`) — the device-trust banner dismissal never
  survived a reload: the "clear once trusted" effect keyed off
  `!isDeviceProbationary`, which is also true while the RPC is in flight, so
  it wiped the stored flag on mount. The conversion worker had pinned this in
  a test _documenting the bug_; the test now asserts the fix.
- **`text-gray-*` sweep** (`374b393`) — 630 occurrences, one pass, isolated
  from behavioural work on purpose. Two tokens added
  (`lob-muted-light` `#97ADB3`, `lob-slate` `#40565C`), each holding
  perceived lightness constant against the gray it replaces, so the intended
  delta is **hue only**. `ScoresRankingTab`'s 2nd-place marker was excluded:
  it was `text-gray-400` acting as a _silver medal_, and now sits alongside
  bronze as a literal hex.

Metrics: tests **1060 → 1175**, lint flat at **61 warnings / 0 errors**
throughout, typecheck clean, `src/` has no untyped files outside `api/`,
`hooks/`, `lib/` and `data/`.

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

**None.** The 2026-07-28 session closed the three display components, the
`text-gray-*` sweep and the TypeScript conversion — the whole of what this
file previously listed. See "Third session" above.

Open questions that were surfaced but are the owner's to decide, not
oversights:

1. **`AuthGate`'s default export has zero call sites.** `grep -rn "<AuthGate"
src/` returns 0; only `SignInBanner` and `useAuthPrompt` from that module
   are used. Typed and kept, not deleted — same category as the orphans in
   `ARCHITECTURE.md` Open Work.
2. **`formatTime` is duplicated** between `AdminSecurityPanels` and
   `ApproveDevicesWidget` and the two **behave differently** (the admin one
   has a `>7d` branch and a different fallback). Merging changes rendered
   timestamps, so it was left alone rather than force the de-dup CLAUDE.md
   asks for.
3. **`.progress-bar` / `.progress-fill` / `.progress-paid` in `index.css` now
   have no users.** Deleting CSS is its own review surface; left in place.
4. **`api/oscars.ts`'s `loadOscarMatches` is uncalled.** Removing it strands
   `oscarMatchRowSchema` and its tests — drop the function, schema, type and
   test block as one piece or not at all.
5. **`SignupRequest` / `PlayerForm` were NOT de-duplicated.** This is
   answered, not deferred: they have drifted past free extraction (modal vs
   card container, four `isAdmin` copy variants in one and none in the other,
   divergent playtomic and phone-hint wording). Extracting needs a prop per
   divergence and puts rendered copy at risk.
6. **Five oscars reads stay imperative** (categories, my votes, admin
   stats/results/voters). No existing key, no consumer outside `Game`; moving
   them means designing new keys and reworking phase-driven loading — a
   behavioural refactor, not a conversion.
7. **`AppContextValue` types `loginWithPin`'s `error` and `selfSignup` as
   `unknown`** because they wrap untyped `api/auth.js`. Three call sites now
   carry `typeof === 'string'` guards that typing that module would remove.

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
- **Visual pass over the `text-gray-*` sweep** (`374b393`) — the largest
  unverifiable change on the branch, and the reason it was landed alone and
  last. Body text across the whole app moved from neutral gray to the
  teal-tinted `lob` family. Look at these first, worst-first:
  1. **`RaffleContainer` and `Registration`** — all three `text-gray-900`
     sites were dark text on saturated yellow/amber. Teal-on-yellow is the
     most complementary pairing in the sweep, so this is where the tint shows
     most. Contrast is still high; it is a taste question, not a legibility
     one.
  2. **`History` and `PlayerProfileDrawer`** (16 sites each) — the heaviest
     `text-gray-400` users. Dense metadata screens where most text is at the
     lightest tier, so the cast of the _whole screen_ moves, not one label.
  3. **`PlayerAliasMatcher` and `AdminSecurityPanels`** — light-tier text on
     `bg-gray-*` surfaces that did **not** move. Neutral-gray backgrounds
     under teal-tinted text is exactly where a tint reads as a mistake rather
     than a choice. Best place to judge whether the two families coexist.
  4. **The 14 `/60` sites** — the only ones whose opacity changed as well as
     hue. `#97ADB3` at 60% lands near `#C7D3D6` vs `gray-300`'s `#D1D5DB`.
     Check the BYE dashes (`LeagueMatchCard`, `BracketMatchSlot`) and the
     hover-revealed delete icons (`AdminSection`, `CategoryEditor`) — if
     anything now reads too faint or not faint enough, it is one of these.
  5. **`TeamPage`'s stat cells** went from `flex flex-col items-center` +
     `<span>` to `text-center` + `<p>`. Identical unless a label wraps, and
     `"Set +/−"` is the one that might on a narrow screen — it would now
     centre where it previously left-aligned. Check that modal on a phone.

## Landmines — do not trip these

- **`src/` has no `text-gray-*` left — keep it that way.** Neutral text uses
  `lob-dark` / `lob-slate` / `lob-muted` / `lob-muted-light`. Nothing enforces
  this, so a new `text-gray-500` will slip in unnoticed and read as a
  near-invisible inconsistency next to the tinted family. `bg-gray-*` and
  `border-gray-*` were deliberately **not** swept (234 occurrences, unchanged)
  — surfaces and borders are a separate decision from text.
- **`ScoresRankingTab`'s medal colours are literal hexes on purpose.** Silver
  (`#9CA3AF`) and bronze (`#CD7F32`) live in `MEDAL_HEX`, outside the token
  system, because silver was previously `text-gray-400` and a token sweep
  tints it teal — which breaks the metaphor rather than restyling it. Do not
  "finish the job" by tokenising them.

- **`lint-staged`'s backup stash is _not_ a hazard — don't "fix" it.** The
  pre-commit hook prints `Backed up original state in git stash (<hash>)`,
  which reads like the `git stash` this project has been bitten by. It isn't.
  With default options (`hideUnstaged: false`, `lib/state.js`) lint-staged
  takes the `git stash create` + `git stash store` branch
  (`gitWorkflow.js:272-274`): that records a stash _object_ and leaves the
  working tree untouched. The destructive `git stash push --keep-index`
  branch only runs under `--hide-unstaged`, which nothing here passes.
  An earlier revision of this file claimed committing mid-worker would stash
  a worker's work. It would not.
  The one real working-tree mutation is `hidePartiallyStagedChanges`
  (`shouldHidePartiallyStaged` defaults true): for files with **both staged
  and unstaged hunks** it reverts the unstaged hunks while tasks run, then
  restores them. Staging whole files — which the "stage explicit paths" rule
  already gives you — avoids it entirely.
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
