# Admin rebalancing & gender balance — options

Status: owner answers recorded in §6 (2026-10-15). Direction: ship D + A + B
together, targeting event #12 on Sun 2026-10-18. Implementation plan:
[`PLAN.md`](./PLAN.md).

## 1. The ask

Give admins more control to rebalance matches while scheduling, mainly to get
better male/female balance on courts. One idea: make the existing swap control
(today it only appears on a repeat-opponent chip) available more widely.

## 2. What the research found

### 2.1 Gender balance got worse when V2 shipped

Court make-up of every saved schedule since May (read-only prod query). A
**mismatched court** has unequal women per team: 1W1M vs 2M, or the reverse.
The player sees one woman on court with three men.

| Event | Generator | Roster      | MF v MF | Men-only |          Mismatched | Unavoidable mismatched |
| ----- | --------- | ----------- | ------: | -------: | ------------------: | ---------------------: |
| #6    | V1        | 22M/10F, 8c |      30 |       18 |               **0** |                      0 |
| #7    | V1        | 22M/6F, 7c  |      16 |       25 |               **0** |                      0 |
| #8    | V1        | 18M/6F, 6c  |      16 |       19 |               **0** |                      0 |
| #9    | V2        | 22M/10F, 8c |      13 |        8 | **26 + 1 lopsided** |                      0 |
| #10   | V2        | 17M/11F, 7c |      27 |        4 | **10 + 1 lopsided** |                      6 |
| #11   | V2        | 18M/10F, 7c |      20 |        4 |              **18** |                      0 |

All are mixed events, 6 rounds, no sit-outs. "Unavoidable" = 1 per round when
the number of women playing is odd, otherwise 0. Even courts hold 0, 2 or 4
women, so an odd count forces exactly one uneven court and an even count forces
none. **#12 (Oct 18, 13M/7F, 5
courts) has no schedule yet. At least 1 mismatched court per round is
unavoidable there.**

### 2.2 Root cause: the cost model doesn't look at court make-up

- `mixedPreference` (`domain/cost.ts`) counts **same-gender teams** above the
  unavoidable number. It never looks at who faces whom. MM vs MM and MM vs MF
  cost exactly the same.
- Women's ratings average lower than men's on our rosters (~1.8 vs ~2.3). So
  "strong man + woman vs two men" often scores _better_ on level balance. The
  engine actively picks mismatched courts.
- Gender is also the lowest priority (weight 0.3, last in `matcherPriorities`).

Simulation: 10 seeds × 4 realistic rosters, `balanced` preset
(now `scripts/mm-gender-sim.ts`):

| Roster             | mixedPref 0.3 (today) | 1.0 | 3.0 | Unavoidable |
| ------------------ | --------------------: | --: | --: | ----------: |
| 18M/10F, 7c        |                   39% | 37% | 38% |          0% |
| 17M/11F, 7c        |                   43% | 31% | 31% |         14% |
| 22M/10F, 8c        |                   41% | 42% | 43% |          0% |
| 13M/7F, 5c (≈ #12) |                   49% | 43% | 44% |         20% |

Raising the weight removes all-female _teams_ (FF), but **it doesn't reduce
mismatched courts**. A priority knob alone won't fix this.

### 2.3 What admins can do today

- **V2 "Fix" on repeat chips** (`ui/RematchFixPanel.tsx`, `domain/swaps.ts`,
  D-026). Swaps two playing players in the same round. Re-scores the whole run.
  Filters for hard-rule legality and a balance limit. Offers the top 3. Only
  reachable from a rematch chip. Sitters never move.
- **Gender isn't shown in the V2 preview.** `ScheduleRounds` shows lefty and
  provisional marks only, so an admin can't even see a mismatched court before
  saving. (`court.players[].gender` is already in the run, so this needs no
  schema change.)
- **The old tap-to-swap mode is dead code.** `events/Schedule.tsx` still has
  `swapMode`/`handlePlayerTap` and "Edit existing schedule". But it's only
  reachable through `ScheduleGeneratorControls`, which renders when
  `!useV2Matcher` (non-admin) and then returns null for non-admins. Nobody can
  reach it. `validateSchedule.ts` has the court-level gender rule V1 respected
  (`gender-mismatch`) and V2 lost.
- **No editing after save.** Saving clears the preview. Changing a saved
  schedule means regenerating, which loses any hand edits.
- The saved-schedule view labels a 3M1F court "Mixed", the same as MF v MF.

## 3. Options

The problem has two layers: the engine **creating** avoidable mismatches, and
admins **lacking a control** to adjust what's left or override by preference.
Options A–C are controls, D–E are engine-side. They combine.

### A. Show it, then "Fix" it (extend the existing pattern)

Show gender in the preview (a per-player mark plus a court chip:
"Mixed · Men · 3M 1W") and add a **Fix** chip on _avoidable_ mismatched
courts. It opens the same overlay as the rematch fix.

- Generalize `suggestOpponentSwaps` → `suggestSwaps({ target })`, with
  `target: { kind: 'rematch', pair } | { kind: 'genderCourt', courtIndex }`.
  Enumeration, legality, re-scoring and ranking are shared. Only the "does this
  break the target" filter and the copy differ.
- Copy follows D-022: "Swap Dana for Sam — every court even, balance barely
  moves".
- **Pros:** smallest change; reuses a proven engine and UI; D-026 provenance
  reasoning already covers it.
- **Cons:** still problem-driven, not free control. Fixing 18 courts one by one
  is tedious. Without D, admins do the engine's job by hand every event.
- **Size:** S–M. No schema, no migration.

### B. Guided swap from any player (the "more accessible" version)

Every player in the preview is tappable. Tapping one opens a ranked list of
same-round swap partners. Each row says what changes: courts' gender make-up,
balance, new repeats. A "show all" escape lists every legal swap, not just the
top 3.

- Same engine as A, with `target: { kind: 'player', playerId }`. "Breaks
  target" becomes "any legal swap", ranked by total cost change.
- Optional: include **sitter ↔ player** swaps. This is the first swap type that
  touches sit-out fairness, so it needs its own baseline handling. D-026 left
  it out on purpose.
- **Pros:** admins can make any change for any reason (gender, friends,
  "these two shouldn't play"), with the consequences spelled out. Fits the
  D-019/D-022 rule of telling admins what changes on court.
- **Cons:** a per-player overlay is more UI than A. Ranking "any swap" needs a
  clear sort order. Mobile tap targets are small on a dense schedule.
- **Size:** M.

### C. Free tap-to-swap with live consequences

Bring back the V1 interaction on the V2 preview: tap A, tap B, they swap, any
round, sitters included. After every swap the run is re-scored. Quality bars
show the change, and new flags (repeat partner, two lefties, mismatched court)
appear inline. Hard-rule breaks are allowed with a warning, not blocked, and
undo is one tap.

- **Pros:** maximum control, familiar to admins who used V1, deletes the dead
  code by replacing it.
- **Cons:** no guidance. Admins have to find good swaps themselves on a
  28–32 player schedule. Allowing hard-rule breaks needs a decision (and a
  "manually adjusted" marker, deferred in D-026). Re-scoring cost is about one
  `buildScheduleRun` per tap (fine).
- **Size:** M. Can pair with B ("suggest" vs "free swap" modes).

### D. Fix the engine: score court gender make-up (root cause)

Add a court-composition term. Per round, count mismatched courts above the
unavoidable number (odd all-male-team count → 1). Fold it into the existing
**Gender preference** bar so the UI vocabulary doesn't change. Consider also:

- moving gender up in priority (weight decision, see §4 Q2);
- **fairness of who takes the unavoidable mismatch**: rotate it so the same
  woman isn't the lone woman with three men every round. This is a new
  cross-round term, like the repeat terms.
- **Pros:** fixes all events with no admin effort, and gets back V1's 0-mismatch
  result where the roster allows it. Makes A/B/C about preference rather than
  repair.
- **Cons:** goldens change. Needs a DECISIONS entry (frozen-contract rule). The
  trade against level balance is real and unmeasured. Spike first: prototype the
  term and re-run the sim plus #9–#11 rosters to see how much balance it costs.
- **Size:** M (domain + tests + calibration). No schema, no migration.

### E. One-click "Even out genders"

A button on the preview runs a targeted local search: same-round swaps only,
sitters fixed, minimizing mismatched courts under the existing balance limit
(`DEFAULT_MAX_BALANCE_DELTA`). It shows before/after ("4 → 1 mismatched
courts, balance slightly worse") and the admin accepts or rejects.

- **Pros:** gets most of D's result without touching the generator or goldens.
  The admin sees and approves the trade. Reuses the swap machinery.
- **Cons:** works around the cost model instead of fixing it. Two systems with
  different opinions about a "good" schedule. A natural fallback if the D spike
  shows the balance cost is too high to make the default.
- **Size:** S–M.

### Cross-cutting (whichever option ships)

- **Edit after save, before scores.** Load the saved run back into the preview
  (`schedule_runs` already stores it) so late changes don't force a
  regenerate. Unclear whether it's needed. See Q5.
- **"Manually adjusted" provenance** on `schedule_runs` (deferred in D-026). It
  becomes more relevant with B/C. This one would need a migration.
- **Delete the dead V1 swap code** in `events/Schedule.tsx` and
  `ScheduleGeneratorControls` either way. The saved-schedule court chip should
  distinguish "3M 1W" from "Mixed".

## 4. Recommendation (for discussion)

1. **D, starting with a spike.** The data says the problem is mostly the engine.
   Making controls more accessible without D means admins fix around 40% of
   courts by hand every event.
2. **The visibility half of A** ships with or before D. It's cheap, it's needed
   for any control, and it lets admins judge D's output.
3. **B** as the general control. It covers the gender case and every other
   reason to swap, with the consequences spelled out. Add C's free swap as a
   secondary mode only if admins ask for it.
4. **E** only if the D spike shows the balance cost is too high for a default.

## 5. Open questions for owners

1. **What does "balanced" mean on court?** Is MF v MF plus men-only courts the
   target (what V1 did)? Or is a court with one woman and three men acceptable
   if levels are closer?
2. **How much level balance to give up for it?** For example, accept a
   ~0.5-level team gap to avoid a mismatched court?
3. **Should admins be able to break hard rules by hand** (repeat partner, two
   lefties), with a warning? Or are swaps always kept legal?
4. **Are sitter ↔ player swaps in scope?** No recent event had sit-outs, but
   the matcher supports them.
5. **Edit after save:** do admins change schedules between saving and the
   event (withdrawals, transfers)?
6. **#12 on Oct 18:** is anything expected for this event? No option can be
   built, reviewed and merged by then without rushing. Today's best workaround
   is generating several alternatives (Compare) and checking the saved view.
   Even that view can't tell a 3M 1W court from a mixed one.

## 6. Owner answers (2026-10-15)

| #   | Question                                      | Answer                                                                                                                                                                             |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What is "balanced" on court?                  | **Even teams.** Mixed pair vs mixed pair, all-men and all-women courts are all fine and equally preferred. A court with one woman and three men (or the reverse) is what to avoid. |
| 2   | Level balance to give up for it               | **Up to ~0.5 levels** of team gap to avoid an uneven court.                                                                                                                        |
| 3   | Break hard rules by hand?                     | **Allow, with a warning.**                                                                                                                                                         |
| 4   | Sitter ↔ player swaps                         | **Not now.**                                                                                                                                                                       |
| 5   | Edit after save                               | **Occasionally.** Nice to have, not in the first version.                                                                                                                          |
| 6   | Event #12 (Oct 18)                            | **Fast fix if possible.**                                                                                                                                                          |
| —   | Rotate who takes an unavoidable uneven court? | **Yes, rotate.**                                                                                                                                                                   |
| —   | Sequencing                                    | **Recommended order, but ship D, A and B together before Sunday.**                                                                                                                 |

### What the answers change

- **D's main term is uneven courts, not same-gender teams.** All-women courts
  (FF vs FF) count as even, so today's team-level `mixedPreference` penalty is
  no longer the target. As it stands it pushes against FF teams, which can
  rule out good FF vs FF courts. The spike decides whether to lower it, drop it
  or keep it as a tie-breaker.
- **There's now a calibration target for D.** Set the weight so the matcher
  takes on up to ~0.5 levels of extra team gap before accepting an avoidable
  uneven court. Check it with the sim and the #9–#11 rosters: avoidable uneven
  courts should be ~0, and balance should drop by no more than about that much.
- **Rotation is in D's scope.** Add a cross-round term so the odd player out on
  an unavoidable uneven court changes from round to round.
- **B allows hard-rule breaks.** B's ranked list stays legal-first. The "show
  all" view also offers rule-breaking swaps, labelled with the rule they break
  ("Dana & Sam partner again"), and the preview keeps the warning visible until
  it's fixed. The violation still lands in `run.violations`, so the saved
  report stays honest. The "manually adjusted" marker would need a migration,
  so it **stays out of scope** for the Sunday ship.
- **Out of the first version:** sitter swaps, edit after save, option C, option E.

### Risks of the Sunday target

- **About 2 working days for D + A + B, including review and merge.** No
  migration is needed for any of the three, so the database rule doesn't block
  this. Code review before merge still applies.
- **D changes goldens and needs a DECISIONS entry** (frozen-contract rule).
  Calibration is the part that can slip.
- **Suggested cut line if time runs short:** A (gender shown in the preview)
  plus D is the minimum that helps #12. B can follow in the next release
  without blocking either.
- **#12 has an unavoidable floor:** with 13M/7F on 5 courts, there's at least 1
  uneven court per round even with a perfect engine.
