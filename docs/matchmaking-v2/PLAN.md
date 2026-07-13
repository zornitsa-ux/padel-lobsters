# Matchmaking V2 — Implementation Plan

Living document. [`DESIGN.md`](./DESIGN.md) is the what/why;
[`DECISIONS.md`](./DECISIONS.md) is the log; this file is the how/when/who and
the **single source of truth for status**. Every working session updates it.

---

## 1. Session protocol

Work spans many chat sessions and two model tiers. The repo, not the
conversation, carries the state.

**Roles**

- **Coordinator** (Fable/Opus): owns contracts (`types.ts`, function
  signatures, Zod schemas, test specifications), all numerics
  (`update.ts`, `calibrate.ts`), search correctness (`cost.ts`, `refine.ts`,
  `feasibility.ts`), task sequencing, and review of all worker output.
- **Worker** (Sonnet): implements one task at a time against a frozen contract
  and its acceptance tests. Workers never edit contracts, this plan's task
  definitions, or files outside their task's "files owned" list.

**Every session starts by reading:** this file top-to-bottom (§4 status first),
the DECISIONS.md tail, and the DESIGN.md sections the current task cites.

**Every session ends by:** updating task statuses below, appending any
DECISIONS entries, and leaving a one-line handoff note in §4 if a task is
mid-flight.

**Status markers**

- `[ ]` not started · `[~]` in progress (add date + one-line state)
- `[x]` done (add PR/commit ref) · `[!]` blocked (say on what)

**Contract freeze rule.** After a phase's contracts task (M1.1 / M2.1) merges,
any change to frozen types or signatures requires a DECISIONS.md entry made by
the coordinator — workers who hit a contract problem stop and report instead
of adapting the contract.

**Worker brief template** (coordinator fills per task, in the task prompt —
briefs are generated from this plan, not stored separately):

```
Task:            <ID + title from PLAN.md>
Read first:      DESIGN.md §<...>; contracts in <files>
Files owned:     <only files the worker may create/edit>
Do not touch:    contracts, PLAN.md task definitions, anything not owned
Acceptance:      <tests that must pass / invariants; from PLAN.md>
Out of scope:    <explicit non-goals, incl. adjacent temptations>
Done means:      npm run typecheck && npm run lint && npm test all pass;
                 tests written before implementation where the task is domain logic
```

---

## 2. Engineering ground rules

- **Domain purity is absolute.** Nothing in `src/features/matchmaking/domain/`
  imports React, Supabase, or anything with side effects. No `Math.random`, no
  `Date.now` — the RNG and clock are injected. This is what makes the engine
  testable and every schedule reproducible.
- **Tests first for domain logic.** Each domain task's acceptance criteria are
  its test list; write them as failing tests, then implement. UI tasks are
  exempt (manual verify + typecheck).
- **TypeScript + Zod at every boundary** per the house feature pattern
  (ARCHITECTURE.md "New Feature Architecture Pattern"). `z.infer` for types;
  `safeParse` in user-facing flows.
- **Small files, single purpose** — the §7 module map in DESIGN.md is the file
  plan; if a file wants to grow past ~200 lines, split it rather than nest it.
- **One task = one PR-sized change.** Land vertically (module + its tests), keep
  `main` green. Migrations follow house rules (local first, manual push,
  `require_admin()` RPCs, no direct table writes from the client).
- **Comments** per CLAUDE.md: only for non-obvious constraints (e.g., _why_ a
  quota exists), never narration.
- **Determinism is a feature.** Same inputs + config + seed ⇒ byte-identical
  `ScheduleRun`. Any PR that breaks a golden test must explain why the behavior
  change is intended.

---

## 3. Dependency overview

```
P0.1 data audit ──► M1.6 calibration        M1.1 contracts ──► M1.2..M1.5
P0.2 wiring survey ──► M2.11, M3.*          M2.1 contracts ──► M2.2..M2.10
Phase 1 gate (backtest ≥ parity) ──► Phase 2 shadow gate ──► Phase 3 ──► Phase 4
```

Phases 0 and 1 can run in parallel (the audit informs calibration constants,
not the update-rule code).

---

## 4. Current status

> **Next up:** **owner reviews `shadow-report.md`** (the Phase 2 → Phase 3
> gate). Then Phase 3 M3.1 (migrations + RPCs). Pending owner decision in the
> report: **proposed D-015** — raise the `balanced` preset socialDial 0.35 →
> 0.5 (near-Pareto balance+variety gain on both real rosters). Not applied yet
> (would regenerate goldens); apply + log D-015 if approved.
> Handoff note (2026-07-13, sixth session): **M2.11 shadow comparison done.**
> Dev harness `shadow.harness.test.ts` (fixture-gated on `MM_SHADOW_FIXTURE`,
> mirrors the M1.6 calibrate harness) runs V2 (3 presets, deterministic) vs the
> legacy annealed matcher (5-seed sweep at the prod 5000-iter budget) on two
> anonymized real rosters (32p/8c and 24p/6c, both mixed, 6 rounds), scores both
> under one common `balanced` cost model, and writes `shadow-report.md`.
> **Result: V2 is a decisive win on lopsidedness** (avg team-sum gap 0.7→0.1,
> Balance quality 16–34% → 87–92%), parity on hard rules / partner-repeats /
> gender (all zero violations), and a _tunable_ regression on opponent variety
> in competitive/balanced (social recovers it). Fixture kept out of git
> (anonymized levels/gender/handedness only, in scratchpad) per the calibrate-
> harness privacy pattern; report is the committed deliverable. Everything
> Phase 1+2 (incl. this) committed this session. Prior: Phase 0+1 complete
> (D-010), Phase 2 engine M2.2–M2.10 green (D-011..D-014).

| Phase           | Goal                         | Gate to next                               | State                                        |
| --------------- | ---------------------------- | ------------------------------------------ | -------------------------------------------- |
| 0 Discovery     | Audit data + wiring          | findings recorded below                    | done                                         |
| 1 Rating engine | Pure domain + calibration    | backtest ≥ Glicko-2 parity                 | done (gate met, D-010)                       |
| 2 Matcher       | Pure domain + shadow mode    | shadow report reviewed on 1–2 real rosters | M2.1–M2.11 ✓; **gate: owner review pending** |
| 3 Integration   | Schema, services, admin UI   | feature-flagged V2 generates a real event  | not started                                  |
| 4 Cutover       | Ratings live, legacy deleted | two clean events on V2                     | not started                                  |

---

## 5. Work breakdown

Owner column: **C** = coordinator, **W** = worker (coordinator reviews all).
Size: S ≈ half-day, M ≈ 1–2 days, L ≈ needs splitting when reached.

### Phase 0 — Discovery & audit

- `[x]` **P0.1 — Historical data audit** (W, M — done 2026-07-10, uncommitted)
  Delivered: 290 scored matches (116 History.jsx + 174 prod DB); median match
  total 7 → D-006; 16/68 historical names unlinked; local stack confirmed
  seed-only, so DB-era numbers came from read-only prod queries. Verdict:
  volume fine for calibration; gates are N_ref units (resolved) + aliases.
  Script in `scripts/mm-audit.mjs` (dev-only, committed) that parses the
  `TOURNAMENTS` constant in `src/components/History.jsx` + DB `matches`
  (local stack) and reports: matches with usable scores per era, point-total
  distribution (→ `N_ref`), players/rounds per event distribution, alias
  coverage gaps. **Deliverable:** `docs/matchmaking-v2/data-audit.md` with the
  numbers and a one-paragraph verdict on §6 calibration feasibility.
  **Acceptance:** doc answers: How many matches have scores? What is median
  total points? Which historical players are unlinked?
- `[x]` **P0.2 — Integration wiring survey** (W, S — done 2026-07-09, uncommitted)
  Appendix A filled. Key findings: matches/settings use RLS-gated direct
  writes (not RPCs) today; duration→rounds constant duplicated in two files;
  prod `players.gender` has 7 `''` + 2 `null` rows (~9%) — see §6 watch items.
  Read `Schedule.jsx`, `scheduleHelpers.js`, `useMatchActions`; document in an
  appendix at the bottom of this file: how generation is triggered, how
  `matches` rows are inserted, where duration→rounds is derived, the settings
  feature-flag mechanism, and the distinct values of `players.gender` in prod
  (`select distinct gender`). **Acceptance:** appendix filled in; no code changes.
- `[x]` **P0.3 — `adjustment` deprecation inventory** (W, S — done 2026-07-10,
  uncommitted) Appendix B filled. Surprise: `admin_update_player` also writes
  both columns — owner decision queued in §4.
  List every read/write of `adjustment` / `adjusted_level` (client, RPCs,
  views) in the appendix, as the checklist for M3.3 and Phase 4 drops.
  **Acceptance:** grep-complete list with file:line refs.

### Phase 1 — Rating engine (pure domain)

- `[x]` **M1.1 — Rating contracts + test specs** (C, M — done 2026-07-10, uncommitted)
  Created `src/features/matchmaking/domain/types.ts` (rating-side types + Zod),
  `rng.ts` (seeded mulberry32 + FNV-1a hash, fully implemented and
  golden-tested), signatures for `rating/{model,update,guardrails,explain}.ts`
  (stubs throw), and complete acceptance suites for M1.2–M1.5 staged as
  `describe.skip` (49 tests; the implementing task removes only the `.skip` —
  D-005). **Frozen:** rating contracts. `nRef` default 7 per audit (D-006).
- `[x]` **M1.2 — `rating/model.ts`** (W, S — done 2026-07-10, uncommitted)
  Priors from `playtomic_level`, sigma floor/inflation, self-reset transition
  (D-002). **Acceptance:** M1.1 tests for priors, inflation cap, reset.
- `[x]` **M1.3 — `rating/update.ts`** (C, M — done 2026-07-10, uncommitted)
  Batch tournament update per DESIGN §4.2. **Acceptance:** zero-sum symmetry;
  sigma monotone decrease under play; reliability weighting; K-gain asymmetry
  (high-sigma player moves more); no update for players without matches.
- `[x]` **M1.4 — `rating/guardrails.ts`** (W, S — done 2026-07-10, uncommitted)
  Cap/clamp/flag logic per §4.3. **Acceptance:** cap arithmetic incl. sign;
  drift + oscillation flags; flagged remainder preserved exactly.
- `[x]` **M1.5 — `rating/explain.ts`** (W, S — done 2026-07-10, uncommitted)
  Per-match breakdown rows. **Acceptance:** rows sum exactly to Δ (property
  test over random tournaments); stable row ordering.
- `[x]` **M1.6 — `rating/calibrate.ts` + backtest harness** (C, L — done
  2026-07-10, uncommitted) Pure `calibrate.ts` (`backtestBrier` chronological
  predict-then-learn replay + coordinate-descent `fitParams`) with tests; dev
  harness `calibrate.harness.test.ts` (skipped without `MM_CALIB_FIXTURE`)
  builds the dataset from prod + alias-resolved History and writes
  `calibration.md`. Fit on 228 matches. Adopted levelScale 6→7, held the
  learning params (D-010). `expectedShare` extracted to a shared `update.ts`
  export. **Gate MET:** V2 Brier 0.0541 ≤ Glicko-2 0.0577 → Phase 2 proceeds.

### Phase 2 — Matcher engine (pure domain)

- `[x]` **M2.1 — Matcher contracts + test specs** (C, M — done 2026-07-13,
  uncommitted) `types.ts` extended, `presets.ts` skeleton (knob table real),
  contract-docblock stubs for all pipeline modules **plus `generate.ts`
  (D-013)**, `testkit.ts`, `describe.skip` acceptance suites for M2.2–M2.10
  incl. golden snapshot harness. Decisions: D-011 (unknown gender), D-012
  (seeded sweeps + vitest-snapshot goldens; no fast-check), D-013 (contract
  clarifications + task sequencing). **Frozen:** matcher contracts.
- `[x]` **M2.2 — `feasibility.ts`** (C, M — done 2026-07-13, uncommitted)
  Stage-0 audits + relaxation quotas per DESIGN §3.1. **Acceptance:** lefty
  quota math across roster shapes; sit-out arithmetic; gender-mode audits;
  human-readable entries for every relaxation. Partner-repeat quota for
  P < 8 generalized to `2·max(0, rounds − floor(P(P−1)/4))` (each no-repeat
  round consumes 2 of the C(P,2) pairs; matches the frozen P=4 cases).
- `[x]` **M2.3 — `sitouts.ts`** (W→C, M — done 2026-07-13, uncommitted;
  Sonnet worker was killed by a session limit before writing anything, so the
  coordinator implemented inline) Greedy debt-first assignment with rng
  tie-breaks + first-improvement same-round swap passes.
  **Acceptance (invariants):** never consecutive; counts within 1; co-sit
  overlap minimized vs brute force on small fields; deterministic.
- `[x]` **M2.4 — `courts.ts`** (W, S — done 2026-07-13, uncommitted; Sonnet
  worker, coordinator-reviewed) Banding + social dial. **Acceptance:** J=0 ⇒
  strictly level-sorted courts; jitter deterministic per seed. (Sigma slack
  moved to M2.6 — D-013.)
- `[x]` **M2.5 — `teams.ts`** (W→C, S — done 2026-07-13, uncommitted, landed
  after M2.6 as sequenced; coordinator-implemented for session-limit reasons)
  Court split + lefty/gender legality. **Acceptance:** never exceeds lefty
  quota; picks min-cost legal split (exhaustive check — only 3 splits).
- `[x]` **M2.6 — `cost.ts`** (C, M — done 2026-07-13, uncommitted)
  Normalized dimensions per DESIGN §3.2, single scoring entry point used by
  both refine and report. **Acceptance:** each dimension 0 at ideal; unit tests
  pinning the exchange-rate examples from the design; court-spread sigma slack
  (cap′ = cap + max sigma / 2 — D-013).
- `[x]` **M2.7 — `refine.ts`** (C, M — done 2026-07-13, uncommitted)
  Bounded local search; hard rules as move filters, with lexicographic
  violation-repair acceptance + targeted lefty repair (D-014). **Acceptance:**
  never emits quota-exceeding schedule (property sweep 8–32 players × 4–6
  rounds × 0–4 lefties); cost non-increasing; iteration budget respected;
  deterministic.
- `[x]` **M2.8 — `report.ts` + `generate.ts`** (W→C, S — done 2026-07-13,
  uncommitted, landed after M2.9 as sequenced; coordinator-implemented)
  ScheduleRun assembly + quality rollup (per-round attribution via prefix
  diffs of `scoreSchedule`), plus the pipeline orchestrator (D-013).
  **Acceptance:** quality percentages match hand-computed fixtures; violations
  list mirrors relaxations used; generate determinism + hard-legality suite.
- `[x]` **M2.9 — `presets.ts`** (W→C, S — done 2026-07-13, uncommitted;
  Sonnet worker killed by the same session limit, coordinator-implemented)
  Preset→knob resolution + exchange-rate sentence generation. **Acceptance:**
  override precedence (knob beats preset); sentences match live weights.
- `[x]` **M2.10 — Property + golden suite completion** (C, M — done
  2026-07-13, uncommitted) Golden snapshots written for 3 rosters × 3 presets
  (`__snapshots__/golden.test.ts.snap`); all 9 runs emit zero violations.
  **Acceptance:** full invariant list from DESIGN §7 covered; `npm test` < 30s
  (8.4s observed, 580 passing).
- `[x]` **M2.11 — Shadow-mode comparison** (C, M — done 2026-07-13)
  `shadow.harness.test.ts` (fixture-gated, dev-only) runs V2 (3 presets) vs the
  legacy annealed matcher (5-seed sweep) on two real anonymized rosters, scores
  both under one common `balanced` model, writes `shadow-report.md`. Verdict: V2
  decisively wins balance/lopsidedness, parity on hard rules, tunable variety
  regression on competitive/balanced. Preset-tuning frontier included; proposed
  **D-015** (balanced socialDial 0.35→0.5) recorded in the report, **not applied**
  (regenerates goldens) — apply on owner approval. **Gate:** owner reviews the
  comparison before Phase 3 — pending.

### Phase 3 — Schema, services, admin UI

- `[ ]` **M3.1 — Migrations + RPCs** (W, M)
  `mm_*` columns, `rating_events`, `schedule_runs` per DESIGN §5;
  `admin_apply_tournament_ratings`, `admin_review_rating_event`,
  `admin_record_schedule_run` RPCs (house auth patterns); exclude `mm_*` from
  `players_public`. **Acceptance:** `npm run db:reset` clean; RLS advisor clean;
  non-admin calls rejected (SQL tests or scripted checks).
- `[ ]` **M3.2 — Application services** (W, M)
  `generateSchedule.service.ts`, `applyTournamentRatings.service.ts` wiring
  domain ⇄ RPCs per feature-slice pattern (query keys, Zod at boundary).
  **Acceptance:** unit tests with mocked client; invalidation keys correct.
- `[ ]` **M3.3 — Self-edit reset hook** (C design, W implement, S)
  `update_my_profile` change: `playtomic_level` edit ⇒ reset `mm_rating`/
  `mm_sigma` + insert `self_reset` rating event; remove `adjustment` from the
  RPC payload; also strip the `adjustment`/`adjusted_level` writes from
  `admin_update_player` (D-008 — the RPC itself survives). Uses the P0.3
  inventory. **Acceptance:** migration test: edit resets exactly and audit row
  exists; no-op edits don't reset.
- `[ ]` **M3.4 — Admin UI** (W ×4, M each)
  `ConfigPanel`, `SchedulePreview`, `QualityReport`, `RatingReview` — one task
  per component, presentational per house pattern, wired via container.
  **Acceptance:** manual verify on local stack + typecheck; no domain logic in UI.
- `[ ]` **M3.5 — Feature flag + Schedule.jsx integration** (W, S)
  V2 behind a settings flag; old path untouched when off. **Acceptance:** flag
  off ⇒ zero behavior change; flag on ⇒ V2 generates + persists `schedule_runs`.
- `[ ]` **M3.6 — End-to-end verify** (C, S)
  Full local-stack run: roster → generate → play scores → apply ratings →
  review queue. Use `/verify`-style walkthrough; record in this file.

### Phase 4 — Cutover & cleanup

- `[ ]` **M4.1 — Seed ratings** (C, S) — full-history recompute into `mm_*`;
  sanity-compare against `learned_rating` (report outliers to owner).
- `[ ]` **M4.2 — Live** (C, —) — flag on for a real event; auto-adjust enabled;
  monitor two events; capture owner feedback here.
- `[ ]` **M4.3 — Delete legacy** (W, M) — `lobsterMatcher.js`, `glicko2.js`,
  `ratingsRecompute.js`, unused generators (D-001), `learned_rating`/
  `learned_rd`/`adjustment`/`adjusted_level` columns + UI (D-002, P0.3 list).
  **Acceptance:** grep-clean; app fully functional; ARCHITECTURE.md updated.

---

## 6. Risks & watch items

- **Thin calibration data** (P0.1 may reveal): fallback = hand-set constants +
  live-event tuning; the design survives, §6 promises soften (see M1.6 gate).
- **Refine/quota correctness** is the highest-risk code; it stays coordinator-
  owned and property-tested. Never delegate M2.7 wholesale.
- **Worker scope creep**: briefs must carry the "files owned" list; reviewer
  checks the diff touches nothing else.
- **Migration safety**: house rule — local reset + advisors before any push;
  production push stays manual and owner-triggered.
- **The two-generator trap**: `pairingEngine.js` paths still exist until M4.3;
  never "fix" or extend them in the meantime.
- ~~**Gender data is not binary in prod** (P0.2): 7 `''` + 2 `null` of 103
  players.~~ Resolved 2026-07-13 (D-011): explicit `unknown` bucket — never
  penalized, never blocking, offsets the mixed-mode quota; informational audit
  entries only.
- **RPC vs direct-write mismatch** (P0.2): existing `matches`/`settings`
  writes are RLS-gated direct table writes, not the `require_admin()` RPCs
  DESIGN §5 specifies for the new tables. M3.1 needs an explicit DECISIONS
  entry either way. Related: `saveMatches` is delete+insert, so match ids are
  not stable across regenerates — relevant to `schedule_runs` linkage (M3.2).
- ~~**Alias coverage gap** (P0.1): 16/68 historical names unlinked~~ Resolved
  2026-07-10 (D-010): owner chose not to link them; M1.6 dropped the 62
  affected History matches (incl. all of apr2026 + standings-only jan2026) and
  fit on 174 prod + 54 alias-resolved History matches. Parity gate still met.
  Re-linking later only enlarges the calibration set — a future re-fit, not a
  blocker.
- ~~**No TypeScript linting**~~ Resolved 2026-07-10 (D-009): typescript-eslint
  now lints `**/*.{ts,tsx}` and `strictNullChecks` is on; `npm run lint` is a
  real gate again (0 errors). Remaining debt, deliberately deferred: full
  `strict` (42 errors) and `no-explicit-any` warn → error (68 warns).

---

## Appendix A — P0.2 wiring survey findings

_Read-only survey. No code changed._

### 1. Schedule generation trigger

`Schedule.jsx:198` `handleGenerate()` is the single entry point (admin-only,
gated on `isAdmin` at `Schedule.jsx:199`). It builds `playersForMatcher`
(`Schedule.jsx:214-219`: swaps `adjustedLevel` for `learnedLevel` when the
`useLobsterScore` toggle is on) then branches on `tournament.format`
(`Schedule.jsx:221-240`):

- `lobster_matching` → `generateLobsterAnnealed` (imported as alias from
  `src/lib/lobsterMatcher.js`, `Schedule.jsx:8,229-235`). Inputs:
  `(playersForMatcher, numCourts, genderMode, tournament.duration || 90, { pastMatches })`,
  where `pastMatches` is every completed match outside this tournament
  (`Schedule.jsx:226-228`) — used for decayed partner/opponent memory.
- `mexicano` → `generateMexicano` (`scheduleHelpers.js:120`) — generates only
  round 1 up front; later rounds are placeholders regenerated after scores
  land (not traced further, out of scope).
- `roundrobin` → `generateRoundRobin` (`scheduleHelpers.js:132`).
- default (`americano`) → `generateAmericano` (`scheduleHelpers.js:89`).

Americano/roundrobin/mexicano all funnel through `buildOneRound()`
(`scheduleHelpers.js:30`), which calls into `pairingEngine.js`
(`buildSmartPairs`, `pairsToCourtMatches`, `assertRoundCoverage`,
`updateHistories`) — the **legacy generator** referenced in PLAN §6's
"two-generator trap." `generateLobsterAnnealed` is the **second, independent
generator** (own annealing/cost logic in `src/lib/lobsterMatcher.js`) — not
traced further here per task scope.

Result is staged into local state (`setGenerated`, `Schedule.jsx:242`) and
validated client-side (`validateSchedule`, `Schedule.jsx:243`) before the
admin explicitly saves.

### 2. How `matches` rows are persisted

Direct table writes, not RPC. `handleSave()` (`Schedule.jsx:249-262`) calls
`saveMatches(tournament.id, generated.map(r => r.matches))` from
`useMatchActions()` (`useMatches.ts:26,37-43`), which calls
`q.saveMatches` (`matchQueries.ts:82-97`):

```
await supabase.from('matches').delete().eq('tournament_id', tournamentId)
// ...map GeneratedMatch (camelCase) -> MatchRow (snake_case)...
await supabase.from('matches').insert(rows)
```

Full delete + re-insert per save (no diffing/upsert). Row shape: `tournament_id,
round, court, team1_ids, team2_ids, team1_level, team2_level, score1, score2,
completed`. Score edits go through `updateMatch()` (`matchQueries.ts:99-105`,
`.update()` on `id`), wrapped by `useMatchActions().updateMatch`
(`useMatches.ts:45-67`) which does an optimistic cache patch + Broadcast
fan-out (`scoreChannel.ts`), not a DB round-trip for peers.

**Authorization note:** both `matches` and `settings` (see §4) are writable
directly from the client with no RPC layer — protected only by RLS
(`matches_admin_write` / `settings_admin_write` policies, both
`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`). This is the _actual_
current pattern, not the `require_admin()` RPC pattern PLAN §2 describes as
house rule — see "Surprises" below. M3.1/M3.2 should decide explicitly
whether new `mm_*`/`rating_events`/`schedule_runs` writes follow the RPC
pattern (as DESIGN §5 specifies) or this table+RLS pattern already in use for
matches/settings.

### 3. Duration → rounds derivation

Two different mechanisms depending on format, **not unified**:

- **Lobster:** hard-coded in the generator itself —
  `lobsterMatcher.js:84`: `const numRounds = duration >= 120 ? 6 : 5`. The
  same `duration >= 120 ? 6 : 5` expression is **duplicated** for display
  only in `ScheduleGeneratorControls.tsx:66` (a badge showing "X rounds ·
  partners rotate"). If the threshold ever changes it must change in both
  places.
- **Americano/Mexicano:** `rounds` is a plain UI selection, not derived from
  duration at all — `Schedule.jsx:51` (`useState(4)`), set via 2–6 buttons in
  `ScheduleGeneratorControls.tsx:71-88`, passed straight through to
  `generateAmericano`/`generateMexicano`.
- **Round robin:** rounds = `min(active.length - 1, 6)`
  (`scheduleHelpers.js:143`), independent of duration or the `rounds` state.

### 4. Settings / feature-flag mechanism

Single-row (`id = 1`) table `public.settings`, defined in
`supabase/migrations/20250503000000_init.sql:88-95`, extended over time via
plain `ALTER TABLE` (e.g. `raffle_cooldown_tournaments` added in
`supabase/migrations/20260527000001_raffle_rebuild.sql:16-17`). Columns today:
`whatsapp_link`, `group_name`, `padel_tips` (jsonb), `auto_trust_until`,
`raffle_cooldown_tournaments` — no boolean flags exist yet.

- **Read:** `useSettings()` (`src/features/settings/useSettings.ts:5-11`) →
  React Query → `fetchSettings()` (`settingsQueries.ts:14-23`), which
  explicitly names columns in its `.select()` (not `select('*')`) — any new
  column must be added to that list plus `settingsRowSchema`
  (`settingsSchemas.ts:7-15`) to reach the client at all.
- **Write:** `useSaveSettings()` (`useSettings.ts:13-19`) → `saveSettings()`
  (`settingsQueries.ts:29-49`) → `supabase.from('settings').upsert(payload)` —
  direct write, gated by RLS policy `settings_admin_write`
  (`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`,
  `supabase/migrations/20260518000014_rbac_jwt_admin.sql:65-67`), not an RPC.
  Called from `Settings.jsx:270` (`handleSave`); admin-only form lives in
  `AdminSection.jsx`, rendered conditionally at `Settings.jsx:375-399`.
- **A `matchmaking_v2_enabled`-style flag** would most naturally be a new
  boolean column on `settings`, added the same way
  `raffle_cooldown_tournaments` was, then wired into `fetchSettings`'s select
  list + `settingsRowSchema` + `saveSettings`'s payload + an `AdminSection.jsx`
  toggle, and read in `Schedule.jsx` via `useSettings()` — the same hook
  `Settings.jsx` already uses. No new RLS policy needed (existing
  `settings_admin_write` covers any column on the table).
- **Do not confuse with `useLobsterScore`:** the existing
  `useLobsterScore` toggle in `Schedule.jsx:63-66` is **not** a settings-table
  flag — it's `usePersistentBoolean('lobster_use_score_for_matcher', false)`
  (`schedule/usePersistentBoolean.ts`), a per-browser `localStorage` value
  with no admin gating and no server round-trip. It is the wrong model to
  copy for a global "V2 enabled" flag (M3.5 needs a flag shared across all
  clients/admins, not per-device).

### 5. `players.gender` distinct values (production)

Queried directly against **production** via `mcp__supabase__execute_sql`
(remote MCP server, read-only `select`):

```sql
select gender, count(*) from players group by gender order by count(*) desc;
```

| gender              | count |
| ------------------- | ----- |
| `male`              | 64    |
| `female`            | 30    |
| `''` (empty string) | 7     |
| `null`              | 2     |

No non-binary/other value is present, but **both empty-string and null exist**
alongside `male`/`female` — 9 of 103 players (~9%) are in neither bucket.
DESIGN §3.1's gender-mode composition audit (stage 0) needs an explicit
policy for these 9 players (exclude from mixed-mode gender balancing? treat
as a third bucket? block them from gender-restricted events?) — not just a
binary split.

### Surprises for the coordinator

- **RLS-gated direct writes, not RPCs, is the existing pattern** for both
  `matches` and `settings` — contradicts PLAN §2's stated house rule
  ("no direct table writes from the client"). DESIGN §5 already commits new
  M3.1 tables to `require_admin()` RPCs; worth an explicit DECISIONS note on
  why the new tables diverge from the established matches/settings pattern
  (or don't).
- **Two independent duration→rounds constants** (`lobsterMatcher.js:84` and
  `ScheduleGeneratorControls.tsx:66`) that must be kept in sync by hand today.
- **`players.gender` has empty-string and null rows in prod**, not just
  male/female — a real input V2's feasibility audit must handle.
- `saveMatches` does a full delete+insert per save/reshuffle rather than a
  diff/upsert — relevant if M3.2's service layer wants to preserve match
  `id`s (e.g. for `schedule_runs` linkage or in-flight score entry) across a
  regenerate.

## Appendix B — P0.3 `adjustment` inventory

Grep-complete inventory of every read/write of `players.adjustment` /
`players.adjusted_level` (and camelCase `adjustment`/`adjustedLevel` on the
client) as of 2026-07-10. Method: `grep -rniE "adjustment|adjusted_level"`
across `src/`, `supabase/` (migrations + seed), excluding `node_modules`,
`.git`, `dist`, `build`; every hit triaged by hand below. No generated
`database.types.ts` exists in this repo (Supabase types aren't codegen'd),
and no edge function under `supabase/functions/` references either field.

### DB schema / RPCs / views (source of truth — drive M3.3 and M4.3)

- `supabase/migrations/20250503000000_init.sql:31-32` — `players` table:
  column defs `adjustment numeric default 0`, `adjusted_level numeric default 0`.
  **Drop target for M4.3.**
- `supabase/migrations/20250503000000_init.sql:395-408` (superseded by
  `20260512000001_rbac_phase1_role_column.sql:19-32`, the current view body) —
  `players_public` view SELECTs `adjustment, adjusted_level`. **Client read
  path** (`fetchPlayers`); must drop both columns from the view at M4.3.
- `supabase/migrations/20250503000000_init.sql:951` /
  `20260512000005_rbac_phase4c_player_rpcs.sql:114-129` — `get_my_profile_v2()`
  returns `SETOF players` (i.e. `SELECT *`); implicit read of both columns,
  no explicit column list to edit, but the returned row shape changes once
  M4.3 drops the columns.
- `supabase/migrations/20260512000003_rbac_phase4_admin_rpcs.sql:542-557` —
  `get_all_players_with_pii_v2()` also `SETOF players` / `SELECT *`; same
  implicit-read note as above.
- `supabase/migrations/20260512000003_rbac_phase4_admin_rpcs.sql:31-61`
  (`admin_add_player`) — INSERT writes `adjustment` (from payload, default 0)
  and computes `adjusted_level = playtomic_level + adjustment`. **Write.**
  This is the only version; not redefined later.
- `admin_update_player` (current definition:
  `supabase/migrations/20260526000001_fix_blank_email_overwrite.sql:65-86`;
  earlier superseded versions at `20260512000003_rbac_phase4_admin_rpcs.sql:471-495`) —
  UPDATE writes `adjustment = coalesce(payload->>'adjustment', p.adjustment)`
  and recomputes `adjusted_level`. **Write. Target for M4.3** (admin path
  survives cutover only if the admin UI keeps a manual-override field post-V2;
  otherwise drop these two lines too — see M4.3 scope note).
- `update_my_profile` (current/final definition:
  `supabase/migrations/20260701000000_player_self_adjustment.sql:12-55`;
  superseded prior versions at `20260512000005_rbac_phase4c_player_rpcs.sql:133-175`,
  `20260518000013_rbac_phase7_device_trust.sql:31-73`,
  `20260526000001_fix_blank_email_overwrite.sql:22-64`,
  `20260528000000_magic_link_auth.sql:391-`) — UPDATE writes
  `adjustment = coalesce(payload->>'adjustment', p.adjustment)`, recomputes
  `adjusted_level`, and includes `adjustment` in the `playtomic_updated_at`
  freshness check (line 47). **This is the exact RPC M3.3 targets** — the
  migration this whole task chain (D-002) exists to undo. Self-edit should
  instead reset `mu`/`sigma` per D-002 and drop these three fields entirely.
- `self_signup_player` (`supabase/migrations/20250503000000_init.sql:1077-1130`,
  specifically lines 1116, 1123-1124) — INSERT writes `adjustment` from
  payload and computes `adjusted_level`. **Write.** Not redefined in any
  later migration.
- `supabase/migrations/20260512000001_rbac_phase1_role_column.sql:31-32` —
  re-declaration of `players_public` view column list (part of the RBAC
  view rebuild), includes `adjustment, adjusted_level` — same view as above,
  listed separately because it's a distinct migration file.
- `supabase/seed.sql:36` — `INSERT INTO players (..., adjustment,
adjusted_level, ...)` seed data column list. **Write (fixture).** Must
  update at M4.3 alongside the column drop.
- Not applicable — `players.pin` collision-check functions
  (`verify_player_pin`, `regenerate_pin`, `admin_regenerate_pin`,
  `self_signup_player`'s PIN block, league signup RPC) mentioned in
  CLAUDE.md's "Known Open Work" are a **different deprecation** (plaintext
  `pin` column) and do not reference `adjustment`/`adjusted_level` — verified
  by grep, no overlap.
- Not applicable — `supabase/migrations/20260523000001_league_schema.sql` has
  zero hits for `adjustment`/`adjusted_level`; league signup does not touch
  this mechanism.

### Client writes (feed the RPCs above — targets for M3.3/M4.3 UI removal)

- `src/api/auth.js:210` — `selfSignup()` builds the `self_signup_player`
  payload; sets `adjustment: String(parseFloat(data.adjustment) || 0)`.
- `src/features/players/playerQueries.ts:49` — `addPlayer()` builds the
  `admin_add_player` payload; sets `adjustment: parseFloat(data.adjustment) || 0`.
- `src/features/players/playerQueries.ts:100` — `updatePlayer()` conditionally
  sets `adjustment` on the shared payload used for both `admin_update_player`
  and `update_my_profile` (role-gated at call site, same field name for both).
- `src/features/community/Players.jsx:406` — admin Players form submit;
  passes `form.adjustment` into `updatePlayer`/`addPlayer` via the payload
  built at that line.
- `src/features/community/Players.jsx:194,227,293` — form-state reads that
  become writes on submit: `acceptMerge()`, `openEdit()`, and
  `handleLinkConfirm()` pre-fill/merge `form.adjustment` from an existing
  player row before the eventual RPC call.
- `src/features/settings/Settings.jsx:72,111,196` — self-service profile form
  default, load-from-`myPlayer`, and submit payload (`profileForm.adjustment`
  → `updatePlayer` → `update_my_profile`). **Primary self-edit UI M3.3/M4.3
  removes.**
- `src/features/settings/ProfileSection.jsx:112-113,371-372` — controlled
  `<input>` for the adjustment field inside the Settings form (`onChange`
  writes `profileForm.adjustment`); rendering-only uses of the same file are
  listed under client reads below.
- `src/components/SignupRequest.jsx:64,152,248,652-653` — public signup form
  default, prefill, submit payload, and controlled `<input>` for "Personal
  Adjustment" (feeds `selfSignup` → `self_signup_player`).
- `src/features/community/PlayerForm.jsx:240,248-249,256` — admin add/edit
  player form's "Personal Adjustment" field (label, controlled `<input>`,
  live preview) feeding `addPlayer`/`updatePlayer`.
- `src/features/community/playerConstants.js:40` — shared form default
  object `{ adjustment: '0', ... }` used to initialize the above forms.

### Client reads (display-only; badges/derived values — targets for M4.3 UI removal)

- `src/features/players/playerQueries.ts:16` — `fetchPlayers()` SELECT column
  list includes `adjustment, adjusted_level` from `players_public`.
- `src/features/players/playerSchemas.ts:24-25` — Zod
  `playerPublicRowSchema` fields `adjustment`, `adjusted_level`
  (`nullableNumber`); gates both the public-roster and `get_my_profile_v2`
  parse paths (`myProfileRowSchema` extends this schema).
- `src/lib/normalise.ts:17-18,41-42` — `Player` type fields `adjustment`,
  `adjustedLevel`; `normalisePlayers()` maps snake_case `adjustment`/
  `adjusted_level` → camelCase, the single normalisation choke point every
  other camelCase read below depends on.
- `src/features/settings/ProfileSection.jsx:74-75,80,169,174-175` — renders
  "Adjustment: +N -> effective level" text and the computed
  `playtomicLevel + adjustment` preview in the read-only profile view.
- `src/features/community/PlayerProfileDrawer.jsx:134-136,139-140,153,156-157` —
  renders the admin player-detail drawer's adjustment badge, `adjustedLevel`
  level badge, and a learned-vs-adjusted delta comparison.
- `src/features/community/PlayersList.jsx:69,71` — renders `adjustedLevel`
  level badge in the community player list.
- `src/features/community/LinkPlayerModal.jsx:51` — renders `adjustedLevel`
  badge ("Lv X.X") when picking an existing player to link a pending signup to.
- `src/features/community/PendingApprovalsList.jsx:22` — renders
  `adjustedLevel` badge in the pending-approvals list.
- `src/components/PlayerAliasMatcher.jsx:336` — renders
  `adjustedLevel || adjusted_level` badge (handles both cases — reads a row
  that may not have gone through `normalisePlayers`).
- `src/components/TransferSpotModal.jsx:139` — renders `adjustedLevel` badge
  in the spot-transfer picker.
- `src/features/events/registration/AddPlayerCard.jsx:78` — renders
  `adjustedLevel` badge when adding a player to an event roster.
- `src/features/events/registration/RegisteredSection.jsx:57` — renders
  `adjustedLevel` badge in the registered-players section.
- `src/features/community/reviewScenarios.js:54` — `corpReview()` reads
  `player.adjustedLevel` to pick a level-based joke-review scenario bucket
  (`level-mid`/`level-high`/`level-elite`).

### Scheduling/matchmaking legacy consumers (drop at Phase 4 per D-001; ported code must not reintroduce)

- `src/features/events/Schedule.jsx:108` — sums `adjustedLevel` across a
  team's player ids for a level display.
- `src/features/events/Schedule.jsx:210-217` — "Lobster Score" toggle:
  synthesizes a working player list where `adjustedLevel` is swapped for
  `learnedLevel` when available, falling back to `adjustedLevel` otherwise —
  this is the live bridge between the legacy and learned-rating worlds today;
  **the M1–M3 rating engine replaces this fallback chain, not just the field
  name.**
- `src/features/events/schedule/types.ts:8` — `SchedulePlayer.adjustedLevel?:
number` type field consumed by the generators below.
- `src/features/events/scheduleHelpers.js:59,90,133` — three generator
  functions sort players by `adjustedLevel` descending (Americano-simple,
  Mexicano, RoundRobin per D-001's naming — confirm exact generator names
  against `scheduleHelpers.js` if reused).
- `src/lib/lobsterMatcher.js:65,121,237` — legacy annealed Lobster matcher:
  JSDoc param note, sort-by-level, and the `level` array passed into the
  optimizer all key off `adjustedLevel`. **This is the generator V2 replaces
  (D-001); its `adjustedLevel` usage does not carry forward.**
- `src/features/events/pairingEngine.js:11,18,145` — cost-scoring pair
  builder scores pairs by `adjustedLevel` difference/sum. Per D-001 this
  generator is deleted at cutover (never used in production), so this usage
  is dropped wholesale rather than migrated.

### Tests / fixtures / docs

- `src/features/players/players.test.ts:19,32` — fixture rows with
  `adjusted_level`/`adjustedLevel` values exercising `normalisePlayers`.
- `src/lib/normalise.test.ts:16,35,44-45,62-63,84,98` — `normalisePlayers`
  unit tests covering the `adjustment`/`adjustedLevel` mapping (present,
  zero, and fallback-missing cases).
- `docs/matchmaking-v2/DESIGN.md:44,68,278,345,400,428,431` — design doc's
  own references to the mechanism being dropped (D-002 rationale, Phase 4
  deletion list, `RatingReview.tsx` naming note). Not code; no action needed
  beyond what Phase 4 tasks already reference.
- `docs/matchmaking-v2/DECISIONS.md:30-46` — D-002 itself (decision record,
  not a usage).
- `docs/matchmaking-v2/PLAN.md:238,260,299` — this plan's own task
  descriptions (M3.3, M4.3, and the Appendix A note about
  `Schedule.jsx:214-219`'s `adjustedLevel`/`learnedLevel` swap). Not a usage;
  cross-referenced here for completeness.

### Incidental matches (not applicable — word "adjustment" unrelated to this mechanism)

- `src/data/padelTips.ts:19` — a padel tip string: "Small adjustment steps
  between shots keep you balanced..." — unrelated English usage, also
  duplicated verbatim inside the JSON blob at `supabase/seed.sql:22`.

### Counts

- DB schema/RPCs/views: 9 distinct definitions/declarations (2 table
  columns, 1 view in 2 migration files, 2 `SELECT *` RPCs, 3 write RPCs
  across their current + superseded versions, 1 seed insert), plus 2
  explicit not-applicable checks.
- Client writes: 12 call sites across 9 files (`auth.js`, `playerQueries.ts`
  ×2, `Players.jsx` ×4, `Settings.jsx` ×3, `ProfileSection.jsx` ×1 (2 lines),
  `SignupRequest.jsx` ×1 (4 lines), `PlayerForm.jsx` ×1 (3 lines),
  `playerConstants.js` ×1).
- Client reads (display-only): 13 render/derive sites across 11 files.
- Scheduling/matchmaking legacy consumers: 6 sites across 5 files (all
  slated for deletion under D-001/D-002, not migration).
- Tests/fixtures: 2 files, 8 line groups.
- Docs (self-referential, no action): 3 files.
- Incidental (not applicable): 1 pair (padelTips.ts + seed.sql copy).

No unexpected writers turned up — every write path traces to one of the four
RPCs already named in D-002/CLAUDE.md (`admin_add_player`, `admin_update_player`,
`update_my_profile`, `self_signup_player`). The one thing worth flagging to
the coordinator: `admin_update_player` also writes `adjustment` today, and
D-002/M4.3 don't explicitly say whether the **admin** manual-override path
is kept as a different mechanism or dropped alongside the player self-edit —
worth a one-line decision before M4.3 executes the column drop, since admin
and self-edit currently share the same two columns but conceptually could
diverge.
