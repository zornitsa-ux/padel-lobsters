# Gender rebalance — implementation plan

Coordinator brief and **single source of truth for status**. Read with
[`OPTIONS.md`](./OPTIONS.md) (evidence, options, and owner answers in §6). This
work extends Matchmaking V2, so its protocol and ground rules apply:
[`../matchmaking-v2/PLAN.md`](../matchmaking-v2/PLAN.md) §2–3 (roles, contract
freeze rule, worker brief template, determinism and golden rules).

**Goal.** Ship three things together before event #12 (Sun 2026-10-18):

- **D:** the matcher stops creating avoidable uneven courts and rotates who
  takes the unavoidable ones.
- **A:** admins can see gender in the preview, and uneven courts get a **Fix**
  chip.
- **B:** admins can tap any player to get a guided swap, including swaps that
  break hard rules, with a warning.

**Deadline.** Merged to `main` and deployed by **Sat 2026-10-17 evening**. #11's
schedule was generated on event day, so #12's probably will be too. No database
migration is in scope, so CLAUDE.md's migration rules aren't on the critical
path. Code review before merge still is.

---

## 1. Status

| ID  | Task                                           | Owner                     | Depends on | State |
| --- | ---------------------------------------------- | ------------------------- | ---------- | ----- |
| T0  | Contracts, shared helper, DECISIONS entries    | C                         | —          | [ ]   |
| T1  | Engine terms (uneven court + rotation)         | W, C reviews line by line | T0         | [ ]   |
| T2  | Calibration + owner sign-off                   | C (runs W for sweeps)     | T1         | [ ]   |
| T3  | Gender visibility in preview + saved view      | W                         | T0         | [ ]   |
| T4  | Generalized swap engine                        | W, C reviews line by line | T0         | [ ]   |
| T5  | Swap UI: Fix on uneven courts + tap-any-player | W                         | T3, T4     | [ ]   |
| T6  | Verification + PRs                             | C                         | all        | [ ]   |

Status markers: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

**Baseline (2026-10-15, `scripts/mm-gender-sim.ts`, balanced, 10 seeds × 6 rounds).**
Mean team gap is only ~0.1 level today, so the 0.5-level budget leaves plenty
of room.

| Roster          |  Uneven | Avoidable | Floor | FF-team courts | Lone repeats | Gap mean / p90 / max |
| --------------- | ------: | --------: | ----: | -------------: | -----------: | -------------------: |
| 18M/10F 7c      | 163/420 |       163 |     0 |             20 |           70 |   0.09 / 0.21 / 0.91 |
| 17M/11F 7c      | 180/420 |       120 |    60 |             36 |           70 |   0.09 / 0.20 / 0.82 |
| 22M/10F 8c      | 196/480 |       196 |     0 |             16 |           99 |   0.08 / 0.18 / 0.58 |
| 13M/7F 5c       | 148/300 |        88 |    60 |             19 |           71 |   0.12 / 0.27 / 1.09 |
| Real #11 roster | 204/420 |       204 |     0 |             13 |           96 |   0.12 / 0.27 / 0.98 |

---

## 2. Coordinator protocol for this effort

- **Session start:** read this file, OPTIONS.md §2 and §6, the tail of
  `docs/matchmaking-v2/DECISIONS.md` (D-021, D-022, D-024, D-026, D-034), and
  the code in §5.
- **Session end:** update §1 and the T-sections' checkboxes, and note anything
  left mid-flight.
- **Branching:** create `gender-rebalance` from `main`. Commit T0 there before
  dispatching anyone.
- **Worktree warning:** agents started with `isolation: "worktree"` branch from
  `main`, **not** from `gender-rebalance`. Every worker brief must start with:
  `git fetch && git checkout -B <task-branch> gender-rebalance`, then confirm
  `git log --oneline -3` shows the T0 commit. Diff before merging any worktree
  back.
- **File ownership is the conflict boundary.** T1, T3 and T4 run in parallel
  only because their file lists (§4) don't overlap. If a worker needs a file it
  doesn't own, it stops and reports.
- **Coordinator-owned code:** under V2 rules, `cost.ts`, `refine.ts`,
  `feasibility.ts` and `swaps.ts` belong to the coordinator. Given the deadline,
  T1 and T4 are delegated, but only against tests the coordinator wrote in T0,
  and the coordinator reviews those diffs line by line.
- **Contract freeze:** after T0, only the coordinator changes types or
  signatures, and only with a DECISIONS entry.
- **Owner checkpoints:** (1) the T2 calibration table before PR 1 is opened;
  (2) both PRs before merge. Ask with the AskUserQuestion tool and record the
  answer here.

### PR shape and cut line

- **PR 1 = T0 + T1 + T2 + T3** (engine + visibility). This alone fixes most of
  #12.
- **PR 2 = T4 + T5** (swap controls), on top of PR 1.
- **Cut line:** if PR 2 isn't review-clean by **Sat 2026-10-17 midday**, merge
  PR 1 alone and ship PR 2 after the event. Owner approved this fallback
  (OPTIONS.md §6 Risks). The coordinator makes the call and records it in §1.

---

## 3. Definitions (frozen in T0)

**Uneven court.** None of the four players has `unknown` gender, and the two
teams have different numbers of women. Even shapes are MF v MF, MM v MM and
FF v FF; all three are equally good (owner answer #1). Courts with an
`unknown` player are never uneven (D-011 spirit: unknown never penalizes).

**Unavoidable uneven courts per round (floor).** 1 if the number of women
playing that round is odd and nobody playing is `unknown`, else 0. Even courts
hold 0, 2 or 4 women, so an odd count forces exactly one uneven court and an
even count forces none.

**Lone player.** On an uneven court with one woman, that woman. With three
women, the man. Uneven courts with 2 women (FF v MM) have no lone player; they
count as uneven but don't add to rotation.

### New cost dimensions

Raw scores, per the existing `cost.ts` unit convention:

- `courtGender` (mixed mode only): per round, `max(0, unevenCourts − floor)`.
- `genderRotation` (mixed mode only): per player, `max(0, loneCount − 1)` over
  the schedule. Accumulate chronologically, attributed to the round where the
  repeat happens, like `partnerRepeat`, so per-round quality works.

**Starting weights.** `courtGender: 1.0` and `genderRotation: 0.5`.

- `courtGender` 1.0 equals 0.5 level of extra team gap: `teamBalance` raw is
  gap / `balanceTolerance` (0.5) at weight 1.0. That's owner answer #2 exactly.
- `genderRotation` 0.5 is a starting guess. T2 tunes it.
- The existing `mixedPreference` (same-gender _teams_) currently discourages
  FF teams and so FF v FF courts, which the owner said are fine. T2 decides
  whether to lower it, keep it as a tie-breaker, or set it to 0. Don't
  delete the key: it's in persisted configs and the quality vocabulary.

### Quality and priorities

- **No new bar.** Both new dimensions fold into the existing **Gender
  preference** bar, so the five-bar vocabulary stays (D-019 one-literacy rule).
- **Exact formula is T0's call.** For example:
  `100·max(0, 1 − (mixedPreference/t + courtGender/n + genderRotation/t))`,
  with t = teams and n = matches.
- **`matcherPriorities` grouping:** gender sums `mixedPreference + courtGender
  - genderRotation`. Gender will move up the ranked list. Update the
priority-order test that pins
`variety > balance > partnerFairness > sitoutFairness > genderPreference`,
    and check that the D-021 copy still reads correctly.

---

## 4. Tasks

### T0 — Contracts, shared helper, DECISIONS (coordinator)

- [ ] **First commit on `gender-rebalance`:** `docs/gender-rebalance/` and
      `scripts/mm-gender-sim.ts`. They're untracked on `main`'s working tree,
      and worktree agents can't see untracked files. Leave the unrelated
      untracked `docs/pin-auth-removal/` out of it.
- [ ] **New pure module `domain/genderBalance.ts`.** This is the only
      definition of §3, used by cost, report, swaps and the UI:
      `courtGenderShape({ teams, genderOf }) → { women: [n, n], uneven: boolean,
loneId: string | null, label: 'mixed' | 'men' | 'women' | 'uneven' }` and
      `unevenFloorForRound({ playingIds, genderOf }) → 0 | 1`. Write its tests
      first.
- [ ] **`types.ts` weights.** Add `courtGender` and `genderRotation` to
      `DIMENSION_KEYS`, `weightsSchema` and `DEFAULT_WEIGHTS`. Nothing parses
      persisted `schedule_runs` with Zod today (checked 2026-10-15), so old rows
      aren't at risk. Re-check before freezing.
- [ ] **Report flag.** Add `'gender-uneven'` to the court flags in
      `report.ts`, plus `'gender-uneven-avoidable'` when the round's uneven
      count exceeds its floor. `flags` is `string[]`, so there's no schema
      change. The UI reads these flags; it never recomputes from scratch.
- [ ] **Swap contract in `domain/swaps.ts`.** Types and signatures only;
      T4 implements them.

  ```ts
  export type SwapTarget =
    | { kind: 'rematch'; roundIndex: number; pair: [string, string] }
    | { kind: 'unevenCourt'; roundIndex: number; courtIndex: number }
    | { kind: 'player'; roundIndex: number; playerId: string }

  export interface SwapSuggestion {
    move: SwapMove
    run: ScheduleRun
    breaksTarget: boolean
    opponentRepeatDelta: number
    balanceDelta: number
    unevenCourtDelta: number // avoidable uneven courts after − before
    newViolations: Violation[] // in run.violations, not in the input run's
  }

  export function suggestSwaps(args: {
    run: ScheduleRun
    players: PlayerInput[]
    genderMode: GenderMode
    feasibility: FeasibilityResult
    target: SwapTarget
    allowRuleBreaks?: boolean // default false
    maxBalanceDelta?: number // default DEFAULT_MAX_BALANCE_DELTA; ignored when showAll
    showAll?: boolean // every same-round candidate, ranked, no limit
    limit?: number // default 3; 5 for kind 'player'
  }): SwapSuggestion[]
  ```

  `suggestOpponentSwaps` stays as a thin wrapper
  (`target.kind = 'rematch'`), so `swaps.test.ts` keeps passing unchanged.

- [ ] **Write the T1 and T4 acceptance tests as failing tests** (lists in T1
      and T4 below).
- [ ] **DECISIONS entries in `docs/matchmaking-v2/DECISIONS.md`.**
  - **D-035:** court gender evenness and rotation terms. Covers §3, owner
    answers, starting weights and the golden impact.
  - **D-036:** generalized manual swap and the hard-rule override. Covers
    DESIGN §2 "no admin pair overrides" still holding, per D-026's reasoning.
    The override is a one-off edit of an artifact, recorded in
    `run.violations`. The `schedule_runs` "manually adjusted" marker stays
    deferred (it needs a migration).
- [ ] Commit to `gender-rebalance`. Gates: typecheck, lint, test.

### T1 — Engine terms (worker; coordinator reviews line by line)

**Files owned:** `domain/cost.ts`, `domain/cost.test.ts`, `domain/teams.ts`,
`domain/teams.test.ts`, `domain/report.ts`, `domain/report.test.ts`,
`domain/presets.ts`, `domain/presets.test.ts`,
`domain/__snapshots__/golden.test.ts.snap`.
**Don't touch:** `types.ts`, `genderBalance.ts`, `refine.ts` (its move set
already covers swaps and re-splits; no change expected; if one seems needed,
stop and report).

- [ ] **`scoreSchedule`:** compute `courtGender` and `genderRotation` raw via
      `genderBalance.ts`. Keep the allocation-free hot loop. Don't build
      closures or arrays per match (see `rosterView` comments). Changing the
      floating-point summation order of _existing_ dimensions breaks men-32
      goldens: add the new terms after the existing ones.
- [ ] **`scoreSplit`:** add the court-evenness cost for the split, so stage 3
      prefers MF v MF over FF v MM when a court has 2W2M.
- [ ] **`report.ts`:** fold into `genderPreference` (T0 formula) and emit the
      T0 flags.
- [ ] **Tests:**
  - a 2W2M court scores MF v MF below FF v MM;
  - 1W3M scores `courtGender` 0 when it is the round's floor and 1 when it
    isn't;
  - any `unknown` on court gives 0;
  - men/women modes give 0 for both terms;
  - rotation counts only the second and later lone appearances, in the round
    they happen;
  - per-round quality sums are consistent.
- [ ] **Goldens:** the men-32 run snapshots must stay **byte-identical**
      (gender terms are inactive there). The fixture snapshot changes, since
      resolved weights now include the new keys. The mixed-16 and mixed-21
      snapshots change; explain why in the PR (§2 golden rule). Zero violations
      stays asserted.

### T2 — Calibration + owner sign-off (coordinator; sweeps can be delegated)

- [ ] **Fetch real rosters** for #9, #10, #11 and #12 with the §7 query into
      the session scratchpad (never commit them).
- [ ] **Sweep** `courtGender ∈ {0.5, 1.0, 2.0}`, `genderRotation ∈ {0.25, 0.5,
1.0}` and `mixedPreference ∈ {0, 0.1, 0.3}`. Run the 4 synthetic rosters
      and the 4 real ones, for all three presets:
      `npx vite-node scripts/mm-gender-sim.ts -- --preset <p> --weights '<json>' [--roster <file> --courts <n>]`.
- [ ] **Acceptance (balanced preset; report competitive and social too):**
  - avoidable uneven courts ≤ 1% of courts on synthetic rosters, and 0 on each
    real roster;
  - lone repeats = 0 wherever the floor total ≤ the minority-gender player
    count (true for every roster above);
  - mean team gap rises by ≤ 0.10 level, and max gap ≤ baseline max + 0.5;
  - variety holds: the Variety quality bar (`run.quality.overall.variety`)
    drops by ≤ 3 points on the real rosters (extend the sim to print it);
  - generation time rises by ≤ 25% (the sim prints ms/run). The preview runs
    on the main thread, about 1s at 32 players.
- [ ] **Owner checkpoint:** show the before/after table for the chosen weights
      and record the answer in §1. If the trade is worse than the criteria,
      stop and present alternatives (e.g. option E from OPTIONS.md) rather
      than shipping.
- [ ] Commit final `DEFAULT_WEIGHTS`, update the goldens, and record the
      results in D-035.

### T3 — Gender visibility (worker)

**Files owned:** `ui/ScheduleRounds.tsx`, a new `ui/genderMarks.tsx` (or
similar), `ui/QualityReport.tsx` (violations visibility only),
`events/Schedule.tsx` (saved-view court chip only), and their tests.

- [ ] **Per-player gender mark** in `TeamNames`, styled like the existing 🤚/📏
      marks, with a Legend entry. Follow D-024's per-player-marks pattern;
      choose the glyph or label in review.
- [ ] **Court chip** from the T0 flags: "Mixed", "Men" or "Women" (neutral),
      and "Uneven · 3M 1W" (amber). When the round's uneven court is the
      unavoidable one, the chip says so ("Uneven · unavoidable this round").
      Copy follows D-022: describe the court, never the cost model.
- [ ] **Violations visible at a glance.** When `run.violations` isn't empty,
      show a compact red summary above the rounds, not only inside
      **Details**. This is needed once B allows rule-breaking swaps.
- [ ] **Saved-schedule view** (`events/Schedule.tsx`, the court chip block
      near "Men"/"Ladies"/"Mixed"): label 3M1W/1M3W courts "Uneven", not
      "Mixed". Compute it with `genderBalance.ts`, since saved matches have no
      report flags.
- [ ] Gate: typecheck, lint, test, and a manual check (T6).

### T4 — Generalized swap engine (worker; coordinator reviews line by line)

**Files owned:** `domain/swaps.ts` (implementation, not the T0 types),
`domain/swaps.test.ts`.

- [ ] **Implement `suggestSwaps`** for all three targets on the existing
      same-round enumerate → score → filter → rank pipeline. Sitters never
      move (owner answer #4).
- [ ] **What "breaks target" means for each kind:**
  - `rematch`: as today.
  - `unevenCourt`: that court is no longer uneven, and avoidable uneven
    courts in the round don't go up.
  - `player`: any swap that moves `playerId`; there's no target filter.
- [ ] **`allowRuleBreaks`:** keep candidates that raise `hardViolations`, and
      fill `newViolations`. Sit-out rule breaks (`null`) can't happen because
      sitters never move, but stay rejected anyway.
- [ ] **Ranking:** legal before rule-breaking, then lower `unevenCourtDelta`,
      lower `opponentRepeatDelta`, lower `balanceDelta`, then `inPlayerId` for
      determinism.
- [ ] **Tests:**
  - every kind and flag combination;
  - existing `suggestOpponentSwaps` tests unchanged and green;
  - `showAll` returns every same-round candidate;
  - `newViolations` matches the `run.violations` diff;
  - deterministic: same inputs give deep-equal output.

### T5 — Swap UI (worker)

**Files owned:** `ui/RematchFixPanel.tsx` (generalize it into a `SwapPanel`, or
rename and keep a re-export), `ui/ScheduleRounds.tsx` (only the entry points;
T3 must be merged first), `MatchmakingContainer.tsx`, and tests.

- [ ] **A — Fix on uneven courts.** Courts flagged
      `gender-uneven-avoidable` get a **Fix** affordance on the court chip. It
      opens the panel with `target.kind = 'unevenCourt'`. Heading: "Even out
      Court N".
- [ ] **B — tap any player.** Player names in the preview are buttons
      (keyboard and screen-reader accessible; tap target ≥ 40px tall on
      mobile). Tapping opens the panel with `target.kind = 'player'`, showing
      the top 5 legal swaps.
  - **"Show all swaps"** re-queries with `showAll: true` and
    `allowRuleBreaks: true`.
  - **Rule-breaking rows** carry a red label naming the rule in padel terms
    ("Dana & Sam partner again", "Two left-handers on one team").
  - **Applying one** leaves the T3 violations summary visible until it's
    fixed.
- [ ] **Row copy (D-022):** "Swap Dana for Sam" plus what changes: gender
      ("evens out Court 2", "makes Court 3 uneven"), then variety and balance,
      reusing the `RematchFixPanel` phrase helpers.
- [ ] **Undo:** a one-step "Undo last swap" (keep the previous preview run in
      container state). Clear it when a new run is generated.
- [ ] **Busy state:** reuse `runDeferred` (`kind: 'fix'`, `scroll: false`) for
      every query.
- [ ] **Out of scope:** sitter swaps, edit after save, free tap-tap swap
      (option C), one-click even-out (option E), deleting the dead V1 swap code
      in `events/Schedule.tsx`. That deletion happens after the event.

### T6 — Verification + PRs (coordinator)

- [ ] **Gates on the branch:** `npm run typecheck && npm run lint && npm test
&& npm run build`. Lint must show 0 errors; report the warning count
      against the baseline.
- [ ] **Sim before/after table** (§1 baseline vs final) pasted into the PR 1
      description and D-035.
- [ ] **Manual check in the running app** (use the `run` skill; local stack
      `npm run db:start` + `npm run dev:local`). Use a local mixed event with an
      odd number of women, e.g. 13M/7F on 5 courts.
  - Generate; check the gender marks and court chips.
  - Exactly 1 uneven court per round, labelled unavoidable, and no lone repeat.
  - Fix and tap-any-player: apply a legal swap, apply a rule-breaking swap
    from "Show all", check the red summary, undo it.
  - Save, then check the saved-view chips.
  - Screenshots go in the PR.
- [ ] **`/code-review` on each PR;** fix the findings before asking the owner.
- [ ] **Open PR 1, then PR 2** (attribution per the session's git rules).
      Owner checkpoint (2) is merge approval.
- [ ] **After merge:** confirm the Vercel deploy is live, update §1 and
      `docs/matchmaking-v2/PLAN.md` §1 (a short note pointing here), and add
      the post-event follow-up to §6.

---

## 5. Code map (read before T0)

| Concern                                   | Where                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cost model, gender team term, hot loop    | `src/features/matchmaking/domain/cost.ts` (`scoreSchedule`, `scoreSplit`, `rosterView`)                                 |
| Same-gender quota helper (team-level)     | `domain/feasibility.ts` `sameGenderQuotaForRound`                                                                       |
| Search / hard rules                       | `domain/refine.ts` (`proposeMove`, `hardViolations`)                                                                    |
| Court split                               | `domain/teams.ts` `splitCourt`                                                                                          |
| Report, quality bars, flags, violations   | `domain/report.ts`                                                                                                      |
| Weights, schemas                          | `domain/types.ts` (`DIMENSION_KEYS`, `weightsSchema`, `DEFAULT_WEIGHTS`)                                                |
| Priorities list                           | `domain/presets.ts` `matcherPriorities`                                                                                 |
| Manual swap engine (rematch only)         | `domain/swaps.ts`, tests `domain/swaps.test.ts`                                                                         |
| Goldens                                   | `domain/golden.test.ts` + `__snapshots__/` (mixed-16, mixed-21-sitters, men-32 × 3 presets)                             |
| Preview UI                                | `ui/SchedulePreview.tsx`, `ui/ScheduleRounds.tsx`, `ui/RematchFixPanel.tsx`, `ui/QualityReport.tsx`, `ui/dimensions.ts` |
| Container / wiring                        | `src/features/matchmaking/MatchmakingContainer.tsx`                                                                     |
| Saved schedule view (+ dead V1 swap code) | `src/features/events/Schedule.tsx`                                                                                      |
| Harness                                   | `scripts/mm-gender-sim.ts`                                                                                              |

---

## 6. Risks and follow-ups

- **Calibration slips.** This is the most likely way to miss Sunday. The cut
  line in §2 protects #12: PR 1 with a conservative `courtGender` weight is
  still a big improvement.
- **Hot-loop performance.** `scoreSchedule` runs about 20k times per generate.
  The new terms must stay allocation-free (T2 checks timing).
- **#12 floor.** 13M/7F on 5 courts has 1 unavoidable uneven court per round,
  even with a perfect engine. Set expectations with organizers.
- **Ratings vs event-day rosters.** T2 rosters use _current_ ratings, which
  moved after each event. That's fine for tuning, but not a replay of what
  the matcher saw.
- **Post-event follow-ups (not before Sunday):**
  - delete the dead V1 swap code in `events/Schedule.tsx` and
    `ScheduleGeneratorControls`;
  - re-run OPTIONS.md §2.1's production court-shape query on #12;
  - revisit edit-after-save and the "manually adjusted" marker.

---

## 7. Real-roster query (read-only, Supabase MCP `execute_sql`)

Anonymized IDs, no names. Save the `roster` value to a scratchpad JSON file and
pass it with `--roster`. Read-only queries against production are allowed
(CLAUDE.md); never write.

```sql
select coalesce(json_agg(json_build_object(
  'playerId', 'p' || rn, 'mu', mu, 'sigma', sigma,
  'isLeftHanded', lefty, 'gender', gender)), '[]') as roster
from (
  select row_number() over (order by p.id) rn,
    coalesce(p.mm_rating, p.playtomic_level, 0)::float mu,
    coalesce(p.mm_sigma, 0.7)::float sigma,
    coalesce(p.is_left_handed, false) lefty,
    case when p.gender in ('male','female') then p.gender else 'unknown' end gender
  from tournaments t
  join registrations r on r.tournament_id = t.id and r.status = 'registered'
  join players p on p.id = r.player_id
  where t.name like 'LOBS #11%'   -- #9: 'LOBStournament #9%', #10: 'LOBS #10%', #12: 'LOBStournament #12%'
) x;
```

Courts per event: #9 = 8, #10 = 7, #11 = 7, #12 = 5.
