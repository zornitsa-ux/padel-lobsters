# Matchmaking V2 — Design

Next-generation matchmaking and level-learning for Padel Lobsters Americano events.
Replaces `src/lib/lobsterMatcher.js` (simulated-annealing scheduler) and
`src/lib/glicko2.js` / `src/lib/ratingsRecompute.js` (client-side Glicko-2).

Companion documents: [`PLAN.md`](./PLAN.md) — status and remaining work;
[`DECISIONS.md`](./DECISIONS.md) — append-only decision log.

This document is the _what and why_ as designed. It is kept current on the model
and the reasoning, not on every implementation detail — **where it conflicts
with DECISIONS.md, DECISIONS wins.** Material changes require a DECISIONS entry.

**Scope (D-001):** only the Lobster (Americano) generation path is replaced. The
other generators in `src/features/events/scheduleHelpers.js` (Americano-simple,
Mexicano, RoundRobin, legacy Lobster) have never been used for real events and
are deleted at cutover, not ported.

Design goals, in priority order:

1. **Balanced, fun matches** — players compete near their level, on both teams.
2. **Explainable** — an admin can always answer "why were these four on a court?"
   and "why did this player's level move?"
3. **Tunable** — per-event dials (competitive ↔ social, max level spread, etc.)
   produce visibly different schedules.
4. **Self-correcting** — post-tournament learning converges each player's level
   toward reality, which in turn makes future schedules better.

---

## 1. Requirements (from design interview, 2026-07-08)

| Area                 | Decision                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Field size           | 16–32 players, 4–8 courts, 4–6 rounds                                                                                             |
| Generation           | Full schedule generated upfront, before round 1                                                                                   |
| Balance definition   | Equal team sums **and** limited within-team partner gap                                                                           |
| Competitive ↔ social | Tunable per event (presets + advanced knobs)                                                                                      |
| Lefty rule           | ≤1 left-handed player per team; hard, relaxable only when mathematically infeasible, with a visible warning                       |
| Gender               | Event modes (`men` / `women` / `mixed`); in mixed, prefer M+F teams (soft)                                                        |
| Variety              | In-event only: no repeat partners, minimize repeat opponents. No cross-event memory, no cohort spreading, no admin pair overrides |
| Sit-outs             | Equalize counts; never consecutive; vary who sits together                                                                        |
| Scoring              | Timed rounds — point totals vary per match                                                                                        |
| Level scale          | Playtomic, community spans ~1.0–5.0                                                                                               |
| Rating model         | Level + confidence (uncertainty shrinks with play)                                                                                |
| Evidence             | Score margins drive updates (as share of points)                                                                                  |
| Governance           | Auto-apply small adjustments; large ones clamped + held for admin review                                                          |
| Visibility           | Learned levels are admin-only                                                                                                     |
| Debug artifacts      | Per-schedule quality score breakdown + constraint violation report                                                                |
| Known pain points    | Lopsided matches **and** frequent repeat partners/opponents                                                                       |

On the pain points: lopsidedness and repeats are the two forces the optimizer
trades against each other. The current matcher expresses that trade in
incomparable raw units (`LEVEL_DELTA: 1.0` per level vs `PARTNER_REPEAT: 200`
per event), spread across nine objectives, several of which (cohort history,
cross-event memory) are no longer wanted. V2's core fix is a smaller objective
set in **normalized, comparable units** with explicit exchange rates, plus a
structural court-banding step so level balance comes mostly from construction,
not from the search.

---

## 2. Shared foundation: the level model

One player-strength representation feeds both systems.

- Each player has a **matchmaking rating** `mu` and an **uncertainty** `sigma`,
  both in Playtomic level units. No foreign scales (Glicko points) anywhere.
- Prior for a new player: `mu = playtomic_level` (self-reported),
  `sigma = 0.7` (i.e., "could plausibly be a full level off either way").
  The legacy `players.adjustment` / `adjusted_level` mechanism is **dropped**
  (D-002): the only inputs are the self-reported Playtomic level and our own
  match results.
- **Self-edit reset (D-002):** when a player edits their Playtomic level, the
  prior re-anchors — `mu ← new playtomic_level`, `sigma ← 0.7` — and the reset
  is logged as a `rating_events` row (`kind = 'self_reset'`) so the history is
  auditable. A player restating their level is telling us our data is stale;
  we believe them, but we go back to low confidence.
- `sigma` shrinks as results accumulate (floor `0.15`) and inflates slowly with
  inactivity (`+0.02` per idle month, capped back at `0.7`).
- **Team strength = sum of the two players' `mu`** — deliberately the same
  quantity the matcher balances, so the matcher and the learner agree on what
  "even" means.
- Matchmaking uses `mu` directly. High-`sigma` players are additionally marked
  in schedule reports, and the court-spread cap is relaxed by half the largest
  `sigma` on the court (D-013) — placing an unknown player "wrong" is cheap,
  and the resulting match is exactly what teaches us their level fastest.

---

## 3. Matchmaking engine

### 3.1 Pipeline

Deterministic construction stages followed by one bounded refinement search.
Every stage emits report entries. Given identical inputs, config, and seed, the
output is identical (seeded RNG injected, no `Math.random`).

```
inputs ──► 0 feasibility audit
       ──► 1 sit-out plan          (whole event)
       ──► 2 court banding         (per round)
       ──► 3 team split            (per court)
       ──► 4 cross-round refinement (bounded local search)
       ──► 5 schedule + report
```

**Stage 0 — Feasibility audit.** Before any search, check every hard rule
against the roster: player count vs courts, lefty count vs team slots
(`lefties_playing > 2 × courts` ⇒ some double-lefty team is unavoidable),
gender-mode composition, sit-out arithmetic. Output: a relaxation plan — the
exact quota of unavoidable violations per rule — and human-readable entries
("9 lefties on 4 courts: at least 1 double-lefty team per round"). The search
may use exactly the quota, never more. Quotas are enforced per round from the
actual round composition; the stage-0 numbers are the reported plan (D-013).

Gender policy (D-011): `''`/null genders normalize to `unknown` at the service
boundary. In mixed mode a team containing an unknown-gender player never
counts as same-gender, and unknowns offset the unavoidable same-gender quota
(`max(0, 2·courts − min(M, F) − U)` per round); in `men`/`women` modes gender
never blocks — mismatches and unknowns are reported informationally, since
rosters are admin-curated.

**Stage 1 — Sit-out plan.** With `P` players and `C` courts, `courtsUsed =
min(C, floor(P/4))` and `sittersPerRound = P − 4·courtsUsed`. Assign sitters
for all rounds at once by _sit-out debt_ (fewest sits first), with two extra
rules: never consecutive (hard), and minimize pairwise co-sitting overlap
(greedy assignment + pairwise swaps). This is a small exact-ish subproblem;
solving it up front keeps the main search out of sit-out trouble.

**Stage 2 — Court banding.** Per round, sort the playing players by an
adjusted key `mu + jitter`, then cut into consecutive groups of 4 (courts).
`jitter` is a seeded draw scaled by the **social dial** `J`:
`J = 0` gives strict level-sorted courts (competitive preset); larger `J`
blurs band boundaries so neighbours mix across rounds (social presets).
This is the structural fix for lopsidedness: courts start level-tight by
construction, and the dial controls exactly how tight.

**Stage 3 — Team split.** Each court of 4 has three possible splits. Pick the
cheapest legal one: lefty rule filters first (hard, minus relaxation quota),
then cost = team-sum gap + partner-gap penalty + mixed-team preference.

**Stage 4 — Cross-round refinement.** Bounded local search (hill climbing with
occasional seeded restarts; fixed iteration budget, ~10⁴–10⁵ moves — trivial
at these sizes). Moves: swap two players between courts in the same round;
swap a sitter with a player; re-split a court. A move is rejected outright if
it violates a hard rule beyond quota — hard rules are move filters, not
penalty weights, so `1e9`-style sentinel costs disappear. The search minimizes
the normalized cost model below, which at this stage is mostly trading
_opponent-repeat_ against _balance_ at the band edges.

**Stage 5 — Emit.** The schedule (same `matches` rows as today) plus a
`ScheduleRun` report (§3.4).

### 3.2 Cost model — normalized units and exchange rates

Every soft dimension is scored `0..1` per match (0 = ideal, 1 = worst
tolerable), so weights are true exchange rates between dimensions.

| Dimension             | Per-match score (before weight)                                                                                      | Default weight |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- |
| Team balance          | `abs(sumA − sumB) / balanceTolerance` (tolerance default 0.5 levels)                                                 | 1.0            |
| Partner gap           | `max(0, abs(muA − muB) − maxPartnerGap) / maxPartnerGap` per team (cap default 1.0 level)                            | 0.8            |
| Court spread          | `max(0, spread − maxCourtSpread) / maxCourtSpread` (cap default 1.25 levels; +`sigma/2` slack for uncertain players) | 1.5            |
| Opponent repeat       | 2nd meeting 0.5, 3rd+ meeting 1.0 each                                                                               | 0.6            |
| Partner repeat        | FIRM: only allowed within a precomputed quota (zero for fields ≥ 8 players); inside quota, 1.0 each                  | 5.0            |
| Mixed-team preference | 1.0 per same-gender team beyond the unavoidable quota (mixed mode)                                                   | 0.3            |
| Sit-group overlap     | pairwise co-sit count above minimum achievable                                                                       | 0.4            |

Because units are shared, the defaults _say something checkable_: "a third
meeting with the same opponent (1.0 × 0.6) costs about the same as a 0.3-level
team-sum gap; a second meeting costs half that" (corrected by D-013 — the
original sentence double-counted). These exchange-rate sentences are a
**designer diagnostic and stay out of the admin UI** (D-021): they convert
between two abstractions, one of which — team-sum gap — the UI never defines.
Admins get preset intent plus the engine's tie-break order instead, phrased in
padel terms (D-022).

Three constraint classes:

- **HARD** — structure (4 per court), lefty rule, no consecutive sit-outs,
  gender mode. Enforced as move filters + Stage 0 quotas. Never traded.
- **FIRM** — partner repeats. Structurally avoidable at every legal field size
  for 4–6 rounds; quota is 0 unless Stage 0 proves otherwise.
- **SOFT** — everything else, weighted as above.

### 3.3 Configuration: presets + knobs

```ts
interface MatchConfig {
  preset: 'competitive' | 'balanced' | 'social'
  // Advanced overrides (all optional; preset supplies defaults)
  socialDial?: number // J: 0 = strict bands … 1 = near-random courts
  maxCourtSpread?: number // levels
  maxPartnerGap?: number // levels
  balanceTolerance?: number // levels of team-sum gap scored as "1.0 bad"
  weights?: Partial<Weights> // exchange-rate overrides
  leftyRule?: 'hard' | 'off' // 'hard' includes auto-relaxation w/ report
  seed?: number // reproducibility; defaults to tournament id hash
}
```

Preset knobs (tuned against replayed real events, §6; live table is
`PRESET_KNOBS` in `presets.ts`):

|                        | competitive | balanced | social |
| ---------------------- | ----------- | -------- | ------ |
| socialDial `J`         | 0.0         | 0.5      | 0.8    |
| maxCourtSpread         | 0.75        | 1.25     | 2.5    |
| opponent-repeat weight | 0.3         | 0.6      | 1.0    |

`balanced.socialDial` moved 0.35 → 0.5 on the M2.11 shadow evidence (D-015).
Presets differ **only** in banding tightness and opponent-repeat weight — the
rest of the weight vector is preset-invariant, so the matcher's tie-break order
is a property of the engine, not of the chosen preset (D-021).

### 3.4 Schedule report (the debug artifact)

Persisted per generation run (§5), rendered in the admin UI.

```ts
interface ScheduleRun {
  tournamentId: string
  config: ResolvedConfig // full resolved config incl. preset expansion
  seed: number
  feasibility: Array<{ rule: string; status: 'ok' | 'relaxed'; detail: string }>
  rounds: Array<{
    // rounds and courts are numbered 1-based in violations (D-013)
    courts: Array<{
      players: PlayerInput[] // full snapshot: id, name, mu, sigma, handed, gender
      teams: [Team, Team]
      teamSums: [number, number]
      courtSpread: number
      flags: string[] // 'opponent-rematch' (high-sigma is now a per-player UI mark; D-024)
    }>
    sitters: PlayerInput[]
  }>
  quality: {
    // 0–100% per dimension; rollup formulas frozen in report.ts (D-013)
    overall: QualityDimensions
    perRound: QualityDimensions[]
  }
  // court is null for violations without one (sit-out rules)
  violations: Array<{ round: number; court: number | null; rule: string; reason: string }>
}
```

- **Quality breakdown** answers "how good is this schedule?" and makes two
  schedules (different presets, different seeds) directly comparable.
- **Violations list** answers "what rules bent, and why" — every relaxed
  constraint appears with its Stage-0 justification. An empty list is the
  common case and is displayed as such.
- Per-court `teamSums` / `courtSpread` / `flags` answer "why these four?"
  at a glance without exposing raw cost internals.

---

## 4. Learning engine

### 4.1 Match evidence

- Observed result of a match = **point share** `p = s1 / (s1 + s2)` — naturally
  normalized across timed rounds with different totals.
- **Reliability weight** `w = min(1, (s1+s2) / N_ref)` with `N_ref` = median
  points of a full-length round (calibrated from history: ≈ 7 per the P0.1
  audit — the ≈24 this design originally assumed was a player's _tournament_
  total, not a match total; D-006). A short or interrupted round simply counts
  for less; no special-casing.
- Expected share from ratings:
  `E = 1 / (1 + 10^(−(T1 − T2) / D))` where `T` is team `mu`-sum and `D` is the
  scale constant — "how many levels of combined advantage produce a 10:1 point
  ratio". `D` is **fit from historical matches** (§6), not hand-picked.

### 4.2 Update rule (per tournament, batch)

All matches in a tournament are evaluated against **pre-tournament ratings**
(rating-period semantics, like Glicko): no in-event ordering artifacts, and it
matches reality — levels were fixed when the schedule was generated.

Per match, per player `i` on team 1:

```
delta_i = w · K_i · (p − E)                    // sign flipped for team 2
K_i     = G · sigma_i² / (Σ_court sigma² + beta²)
```

- `(p − E)` — the surprise: got a bigger/smaller share of points than the
  ratings predicted.
- `K_i` — Kalman-style gain: uncertain players absorb more of the surprise
  than established ones. `beta` is fixed performance noise (a team's on-the-day
  variance) so updates stay bounded even when everyone is uncertain; `G` is the
  global learning scale. Both calibrated in §6.
- Player's **proposed tournament delta** `Δ_i = Σ delta_i` over their matches.
- `sigma` update: `sigma_i² ← 1 / (1/sigma_i² + Σ w·I)` — information
  accumulates per weighted match played; a typical 5-match event moves a new
  player's sigma from 0.70 to roughly 0.45.

### 4.3 Guardrails (auto with review)

- `|Δ| ≤ cap` (default **0.30** levels/event): auto-applied.
- `|Δ| > cap`: apply `sign(Δ)·cap` now, queue the remainder as a **flagged
  adjustment** for admin review with full evidence (§4.4). Admin approves,
  edits, or discards the remainder.
- Additional flags (review queue, no auto-action):
  - cumulative drift: `|mu − playtomic_level| > 1.0` — self-report and results
    disagree persistently;
  - oscillation: three consecutive events with `|Δ| > 0.2` and alternating sign
    — the model can't settle this player (erratic results or bad `beta`).

### 4.4 Explainability

Every rating event stores a per-match decomposition, rendered admin-side as:

> **R3 vs Anna+Marc (Δteam +0.4):** expected 61% of points, got 44% → −0.07
> **R5 vs Piet+Sofia (Δteam −0.2):** expected 47%, got 51% → +0.01

A player's tournament delta is exactly the sum of these lines. This is the
rating-side counterpart of the schedule report: no update is ever "the
algorithm said so".

### 4.5 Why not keep Glicko-2

Glicko-2 works, but: its volatility iteration is an unexplainable black box
(directly against goal 2); it lives in foreign units (1500 ± 350) needing a
translation layer; and it models pairwise individual games, not team-sum
matches, so the learner and matcher disagree about what a balanced match is.
The Gaussian team-sum model above is Elo/TrueSkill-lite: fewer moving parts,
native level units, and additive per-match explanations. Migration validates
it against Glicko-2 on the full match history before cutover (§6).

---

## 5. Persistence

Existing columns already cover inputs: `players.gender`, `players.is_left_handed`,
`players.playtomic_level`. New:

```sql
alter table players
  add column mm_rating  numeric,      -- mu, level units
  add column mm_sigma   numeric,
  add column mm_rating_updated_at timestamptz;

create table rating_events (          -- audit trail: tournament updates + self-resets
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'tournament',  -- 'tournament' | 'self_reset' | 'admin_edit'
  tournament_id uuid references tournaments,        -- null for self_reset/admin_edit
  player_id     uuid references players not null,
  prior_mu numeric not null, prior_sigma numeric not null,
  proposed_delta numeric not null,    -- raw model output
  applied_delta  numeric not null,    -- after cap
  flagged boolean not null default false,
  review_status text,                 -- null | 'approved' | 'edited' | 'discarded'
  reviewed_by uuid, reviewed_at timestamptz,
  breakdown jsonb not null,           -- per-match decomposition (§4.4)
  created_at timestamptz default now()
);

create table schedule_runs (          -- one row per generation run (incl. regenerations)
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments not null,
  config jsonb not null, seed bigint not null,
  report jsonb not null,              -- ScheduleRun (§3.4)
  created_at timestamptz default now()
);
```

`learned_rating` / `learned_rd` stay untouched until cutover, then drop —
along with `players.adjustment` / `adjusted_level` and their UI touchpoints
(D-002). Writes go through `require_admin()` RPCs per house pattern; `mm_*`
values are excluded from `players_public` (admin-only visibility). The
self-edit reset hook lives in `update_my_profile`: a change to
`playtomic_level` resets `mm_rating`/`mm_sigma` and inserts the audit row.

---

## 6. Calibration & validation (uses data we already have)

The hardcoded history (`History.jsx`) plus DB `matches` give hundreds of
completed matches with known participants and scores. Before any UI work:

1. **Fit `D`, `beta`, `G`, `N_ref`** by replaying history chronologically and
   maximizing predictive likelihood of match point shares.
2. **Backtest ratings**: run the new engine over full history; compare
   predictive accuracy (Brier score on point shares) against current Glicko-2
   values. Ship only if ≥ parity.
3. **Replay schedules**: run the V2 matcher on past event rosters; compare
   quality reports against what was actually played (the old matcher's output)
   — this both tunes preset defaults and demonstrates the lopsidedness /
   repeat-rate improvement concretely.

---

## 7. Code structure

Per the repo's feature architecture pattern (TypeScript, Zod, domain pure):

```
src/features/matchmaking/
  domain/
    types.ts            // PlayerInput, MatchConfig, ScheduleRun … (+ Zod schemas)
    presets.ts          // preset → resolved knobs; preset intent + priority order
    rng.ts              // seeded PRNG (mulberry32) + hashSeed, injected everywhere
    feasibility.ts      // Stage 0: audits, relaxation quotas
    sitouts.ts          // Stage 1
    courts.ts           // Stage 2: banding + social dial
    teams.ts            // Stage 3: splits, lefty/gender legality
    cost.ts             // normalized dimensions, single scoring entry point
    refine.ts           // Stage 4: move generation + bounded search
    report.ts           // Stage 5: ScheduleRun assembly + quality rollup
    generate.ts         // pipeline orchestration: audit → … → report (D-013)
    scheduleOps.ts      // shared schedule primitives (clone, canonicalize, pairKey)
    swaps.ts            // post-generation manual opponent swap (D-026)
    testkit.ts          // test-only fixture builders + invariant assertions
    rating/
      model.ts          // mu/sigma types, priors, inactivity inflation
      update.ts         // §4.2 batch update
      guardrails.ts     // caps, flags
      explain.ts        // per-match breakdown rows
      calibrate.ts      // §6 fitting, dev-time
  generateSchedule.service.ts       // roster → domain → matches insert + schedule_runs insert
  applyTournamentRatings.service.ts // results → domain → rating_events + players.mm_* RPCs
  matchmakingSchemas.ts             // Zod boundary
  matchmakingKeys.ts                // React Query keys
  useMatchmaking.ts                 // query + mutation hooks
  useConfigDerivations.ts           // resolve → intent → priorities → feasibility
  ui/
    ConfigPanel.tsx        // preset picker, advanced knobs, preflight chips
    SchedulePreview.tsx    // court cards + inline quality report + actions
    ScheduleRounds.tsx     // round/court rendering, shared with CompareView
    QualityReport.tsx      // dimension bars, violations list
    CompareView.tsx        // full-screen original vs alternative (D-023)
    RematchFixPanel.tsx    // ranked swap suggestions overlay (D-026)
    RatingReview.tsx       // flagged-adjustment queue (D-027)
    dimensions.ts          // dimension labels + plain-English diffs (D-022)
    ratingRecommendation.ts// pre-selects the review mode from the evidence
  MatchmakingContainer.tsx // all wiring; mounted by Schedule.jsx
```

The services sit at the feature root rather than in an `application/`
subdirectory — the repo's other features do the same, and the split was not
worth one extra level for two files.

Everything in `domain/` is pure and deterministic — the whole engine is
testable without Supabase or React. Test emphasis (addresses "no tests on core
algorithms" debt):

- **Invariant/property tests**: no consecutive sit-outs ever; sit-out counts
  within 1; zero partner repeats at every field size 8–32 × 4–6 rounds; lefty
  rule violations never exceed Stage-0 quota; same seed ⇒ same schedule.
- **Golden tests**: fixed rosters + seeds ⇒ committed expected reports (catches
  accidental behavior drift).
- **Rating tests**: symmetric zero-sum updates; sigma monotone under play;
  guardrail cap arithmetic; breakdown lines sum exactly to Δ.

---

## 8. Delivery phases

1. **Rating engine first** (pure domain + calibration + backtest, §6.1–2).
   No UI, no schema change. Validates the level model everything else stands on.
2. **Matcher domain + shadow mode.** Generate V2 schedules alongside the old
   matcher for 1–2 real events (report-only, not played) and compare quality
   reports; tune presets.
3. **Schema + admin UI.** Migrations (§5), ConfigPanel, SchedulePreview,
   QualityReport, RatingReview. V2 becomes the generator. A settings flag was
   built for this phase and then removed before production (D-028): falling back
   to V1 is a code change, deliberately, so an admin cannot half-disable the
   matcher between events.
4. **Cutover.** Seed `mm_rating/mm_sigma` by full-history recompute; enable
   auto-adjustments with guardrails; after two clean events delete
   `lobsterMatcher.js`, `glicko2.js`, `ratingsRecompute.js`, the unused
   generators in `scheduleHelpers.js`/`pairingEngine.js` (D-001), and the
   `learned_rating`/`learned_rd`/`adjustment`/`adjusted_level` columns (D-002).

## 9. Open items (defaults blessed 2026-07-08, revisit during calibration)

All remaining numeric defaults (guardrail cap 0.30/event, sigma-based
court-spread slack `+sigma/2`, preset knob values) were accepted as starting
points (D-003) and are expected to move during §6 calibration and the first
live events. Mid-event dropout regeneration is explicitly out of scope for now
(D-003); the `schedule_runs` design leaves the door open.
