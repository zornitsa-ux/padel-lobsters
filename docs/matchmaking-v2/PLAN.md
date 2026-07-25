# Matchmaking V2 — Implementation Plan

Living document and the **single source of truth for status**.
[`DESIGN.md`](./DESIGN.md) is the what/why; [`DECISIONS.md`](./DECISIONS.md) is
the append-only log of every material call and its reasoning.

Completed-session narration is not kept here — `git log -p docs/matchmaking-v2/`
holds it. This file carries current state, remaining work, and the protocol.

---

## 1. Status

| Phase           | Goal                         | Gate to next                           | State                          |
| --------------- | ---------------------------- | -------------------------------------- | ------------------------------ |
| 0 Discovery     | Audit data + wiring          | findings recorded                      | done                           |
| 1 Rating engine | Pure domain + calibration    | backtest ≥ Glicko-2 parity             | done (gate met, D-010)         |
| 2 Matcher       | Pure domain + shadow mode    | shadow report reviewed on real rosters | done (gate met, D-015)         |
| 3 Integration   | Schema, services, admin UI   | V2 generates a real event              | done                           |
| 4 Cutover       | Ratings live, legacy deleted | two clean events on V2                 | in progress (M4.1 not started) |

**What exists.** V2 is the unconditional generator for every event an admin
opens (D-028, D-030) — `format` no longer gates anything. The pure engine lives
in `src/features/matchmaking/domain/` (feasibility → sit-outs → banding → team
split → refinement → report), the services in `src/features/matchmaking/`, and
the admin UI mounts inside the Schedule tab: configure → generate → compare /
fix repeats → save, then Finish applies ratings and raises the flagged-review
queue. Learned levels (`mm_rating`/`mm_sigma`) are admin-only and feed the next
event's roster. V1 code (`lobsterMatcher.js`, `glicko2.js`,
`ratingsRecompute.js`, `pairingEngine.js`) is still in the tree with no data
path reaching it (D-028).

Gates as of 2026-07-25: typecheck clean, lint 0 errors (136 pre-existing
warnings), **707 pass / 2 skip**, build clean, 9 goldens byte-identical.

### Open items

- **Migration `20260713000001_matchmaking_v2.sql` is not pushed to production.**
  Applied and replayed clean on local only; `npx supabase db push` stays the
  owner's manual step. It carries the whole V2 schema plus, in its own marked
  section, the unrelated pre-existing `settings` write-grant fix — settings
  writes have 403'd in production since 2026-05-18 (`20260518000008` revoked
  INSERT/UPDATE and never re-granted), so that section is worth pushing on its
  own merits.
- **No player has an `mm_rating` yet** — until M4.1 back-fills, everyone enters
  their first V2 event at the `playtomic_level` prior and the admin drawer's
  "Learned level" row stays hidden.
- **Live verification is partial.** The rating loop was verified end-to-end on
  local against a two-event fixture (engine output matched simulation to 3
  decimals; learned mu/sigma provably carried into event ②). The newer UI work
  — Compare overlay (M3.7), Fix-repeat overlay (M3.8), redesigned RatingReview
  (M3.8/D-027), results-reveal gating (D-029) — is code-complete and statically
  green but has not had an owner walkthrough on a phone.

---

## 2. Session protocol

Work spans many sessions and two model tiers. The repo, not the conversation,
carries the state.

- **Coordinator** (Fable/Opus): owns contracts (`types.ts`, signatures, Zod
  schemas, test specs), all numerics (`update.ts`, `calibrate.ts`), search
  correctness (`cost.ts`, `refine.ts`, `feasibility.ts`, `swaps.ts`), container
  wiring, task sequencing, and review of all worker output.
- **Worker** (Sonnet): implements one task against a frozen contract and its
  acceptance tests. Workers never edit contracts, this plan's task definitions,
  or files outside their task's "files owned" list.

**Every session starts by reading** §1 here, the DECISIONS.md tail, and the
DESIGN.md sections the current task cites. **Every session ends by** updating §1,
appending any DECISIONS entries, and noting anything left mid-flight.

**Contract freeze rule.** Changing a frozen type or signature requires a
DECISIONS entry made by the coordinator — a worker who hits a contract problem
stops and reports instead of adapting the contract.

Status markers: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

**Worker brief template** (coordinator fills per task, in the task prompt):

```
Task:            <ID + title from PLAN.md>
Read first:      DESIGN.md §<...>; contracts in <files>
Files owned:     <only files the worker may create/edit>
Do not touch:    contracts, PLAN.md task definitions, anything not owned
Acceptance:      <tests that must pass / invariants>
Out of scope:    <explicit non-goals, incl. adjacent temptations>
Done means:      npm run typecheck && npm run lint && npm test all pass;
                 tests written before implementation for domain logic
```

---

## 3. Engineering ground rules

- **Domain purity is absolute.** Nothing in `src/features/matchmaking/domain/`
  imports React, Supabase, or anything with side effects. No `Math.random`, no
  `Date.now` — the RNG and clock are injected.
- **Tests first for domain logic.** Each domain task's acceptance criteria are
  its test list; write them as failing tests, then implement. UI tasks are
  exempt (manual verify + typecheck).
- **TypeScript + Zod at every boundary** per ARCHITECTURE.md's feature pattern.
- **Small files, single purpose** — DESIGN §7 is the file plan; split rather
  than nest past ~200 lines.
- **One task = one PR-sized change.** Migrations follow house rules (local
  first, manual push, `require_admin()` RPCs for V2 tables per D-016).
- **Determinism is a feature.** Same inputs + config + seed ⇒ byte-identical
  `ScheduleRun`. Any PR that breaks a golden must explain why the behavior
  change is intended. **This binds optimization work too:** the scoring loop's
  floating-point summation order and rng draw order are load-bearing, which is
  why the 3.5× speed-up preserved both. True incremental delta scoring would be
  faster still but cannot preserve summation order — it needs an explicit owner
  call to move the goldens.

---

## 4. Work breakdown

Owner column: **C** = coordinator, **W** = worker (coordinator reviews all).

### Phases 0–3 — complete

Task IDs are cited by the domain test suites (`// M2.5 acceptance tests — frozen
by M2.1`) and by DECISIONS entries, so the index stays. Detail is in git history
and in the code each task produced.

| ID    | Title                               | Landed     | Notes                                                                        |
| ----- | ----------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| P0.1  | Historical data audit               | 2026-07-10 | `data-audit.md`; 290 scored matches; median total 7 → D-006                  |
| P0.2  | Integration wiring survey           | 2026-07-09 | matches/settings write via RLS not RPC → D-016; gender gaps → D-011          |
| P0.3  | `adjustment` deprecation inventory  | 2026-07-10 | drove D-018/D-028; DB remnant is the appendix below                          |
| M1.1  | Rating contracts + test specs       | 2026-07-10 | **froze rating contracts**; D-005, D-006                                     |
| M1.2  | `rating/model.ts`                   | 2026-07-10 | priors, sigma floor/inflation, self-reset (D-002)                            |
| M1.3  | `rating/update.ts`                  | 2026-07-10 | batch tournament update, DESIGN §4.2                                         |
| M1.4  | `rating/guardrails.ts`              | 2026-07-10 | cap/clamp/flag, DESIGN §4.3                                                  |
| M1.5  | `rating/explain.ts`                 | 2026-07-10 | per-match breakdown rows summing exactly to Δ                                |
| M1.6  | `calibrate.ts` + backtest harness   | 2026-07-10 | `calibration.md`; **gate met** V2 Brier 0.0541 ≤ Glicko 0.0577               |
| M2.1  | Matcher contracts + test specs      | 2026-07-13 | **froze matcher contracts**; D-011, D-012, D-013                             |
| M2.2  | `feasibility.ts`                    | 2026-07-13 | Stage-0 audits + relaxation quotas                                           |
| M2.3  | `sitouts.ts`                        | 2026-07-13 | debt-first assignment; never-consecutive invariant                           |
| M2.4  | `courts.ts`                         | 2026-07-13 | banding + social dial                                                        |
| M2.5  | `teams.ts`                          | 2026-07-13 | court split + lefty/gender legality                                          |
| M2.6  | `cost.ts`                           | 2026-07-13 | normalized dimensions; sigma slack (D-013)                                   |
| M2.7  | `refine.ts`                         | 2026-07-13 | bounded local search; quota repair (D-014)                                   |
| M2.8  | `report.ts` + `generate.ts`         | 2026-07-13 | ScheduleRun assembly + pipeline orchestration                                |
| M2.9  | `presets.ts`                        | 2026-07-13 | preset → knob resolution                                                     |
| M2.10 | Property + golden suite             | 2026-07-13 | 3 rosters × 3 presets, zero violations                                       |
| M2.11 | Shadow-mode comparison              | 2026-07-13 | `shadow-report.md`; **gate met**; drove D-015                                |
| M3.1  | Migrations + RPCs                   | 2026-07-13 | `mm_*`, `rating_events`, `schedule_runs`, 3 admin RPCs (D-016)               |
| M3.2  | Application services                | 2026-07-14 | services, keys, Zod boundary, query/mutation hooks                           |
| M3.3  | Self-edit reset hook                | 2026-07-14 | level edit resets prior + audits it (D-008, D-018)                           |
| M3.4  | Admin UI                            | 2026-07-14 | ConfigPanel, QualityReport, SchedulePreview, RatingReview, container (D-019) |
| M3.5  | Schedule.jsx integration            | 2026-07-14 | generate-path swap, score guard, ratings-on-finish                           |
| M3.6  | End-to-end verify + owner findings  | 2026-07-25 | 8 findings → D-020 … D-025, D-027, D-030; all resolved                       |
| M3.7  | Compare → Alternatives overlay      | 2026-07-23 | D-023                                                                        |
| M3.8  | Manual opponent-swap ("Fix" repeat) | 2026-07-23 | D-026; `domain/swaps.ts`                                                     |

### Phase 4 — Cutover & cleanup

- `[ ]` **M4.1 — Seed ratings** (C, S) — full-history recompute into
  `mm_rating`/`mm_sigma` so players stop entering events at the raw
  `playtomic_level` prior. Sanity-compare the result against the old
  `learned_rating` and report outliers to the owner before writing.
  **Acceptance:** every player with match history has an `mm_*` value; the
  admin drawer's learned-level row renders for them; outlier list reviewed.
- `[~]` **M4.2 — Live** (C, —) — two-event observation window. There is no flag
  to enable (D-028); this is watching two real events and capturing owner
  feedback. Watch specifically: schedule quality against the shadow-report
  expectation, the flagged-review queue's volume and whether the D-027
  recommendation thresholds (`STRONG_SURPRISE` 0.22 / `WEAK_SURPRISE` 0.08) are
  right at real volume, and the Compare/Fix overlays on a phone.
- `[~]` **M4.3 — Delete legacy** (W, M) — the UI half is done (D-028): no
  user-facing surface reaches a V1 concept. What remains is code + schema
  deletion.
  - **Code:** `src/lib/lobsterMatcher.js`, `src/lib/glicko2.js`,
    `src/lib/ratingsRecompute.js`, `src/features/events/pairingEngine.js`, and
    the unused generators in `scheduleHelpers.js` (D-001). With those gone, the
    `!isLobster` branch, `formatLabel` (`eventHelpers.js`), the rounds picker in
    `ScheduleGeneratorControls.tsx` and `isLobster` itself all collapse out of
    `Schedule.jsx`.
  - **Schema:** drop `players.learned_rating`, `learned_rd`, `adjustment`,
    `adjusted_level` — see the appendix for the full DB-side checklist.
  - **Also:** a CHECK constraint on `tournaments.format` (the default is now
    `lobster_matching` per D-030, but nothing constrains the column).
  - **Acceptance:** grep-clean; app fully functional; ARCHITECTURE.md and
    CLAUDE.md's "Active Initiative" section updated; no reachable code path can
    select or generate a non-Lobster format.

---

## 5. Watch items

- **Refine/quota correctness** is the highest-risk code; it stays
  coordinator-owned and property-tested. Never delegate `refine.ts` wholesale.
- **The golden snapshots are whole-`ScheduleRun` dumps** (14k lines). Any change
  to the `ScheduleRun` shape pressures toward `--update`-and-eyeball, which
  would defeat their purpose. If `ScheduleRun` is ever refactored, replace them
  with a derived fingerprint first.
- **`mm_*` is deliberately absent from `players_public`** (D-017, DESIGN §5), so
  the client roster cannot carry ratings — they must come from
  `admin_get_mm_ratings()`. Building a roster from `usePlayers` alone silently
  yields null ratings and an engine that re-learns from scratch every event;
  that defect shipped once and went unnoticed for weeks. Guard comments sit at
  `generateSchedule.service.ts:51` and `Schedule.jsx:156`.
- **`matches` writes are not atomic with `schedule_runs`** (D-016) — a failed
  save can be partial, which is why the save-failure copy never claims nothing
  changed.
- **Pre-existing, out of scope, still true:** `PlayerProfileDrawer`'s
  head-to-head and nemesis stats aggregate any match marked `completed`, so they
  leak results before Finish — broader than the D-029 reveal gating and untouched
  by it. `RecentResultsList.jsx` is dead code.
- **Migration safety:** house rule — local reset + advisors before any push;
  production push stays manual and owner-triggered.

---

## Appendix — legacy column drop checklist (M4.3)

The client no longer reads or writes `adjustment` / `adjusted_level` anywhere
(D-028 removed all 25 client sites; `grep -rn "adjustedLevel\|adjusted_level"
src/` is clean outside tests). What remains is DB-side, from the P0.3 inventory:

- `20250503000000_init.sql:31-32` — the two column definitions on `players`.
- `players_public` view — current body at
  `20260512000001_rbac_phase1_role_column.sql:19-32`, selects both columns.
  Must be rebuilt without them.
- `admin_add_player` (`20260512000003_rbac_phase4_admin_rpcs.sql:31-61`) —
  INSERTs `adjustment`, computes `adjusted_level`.
- `admin_update_player` (`20260526000001_fix_blank_email_overwrite.sql:65-86`) —
  same, on UPDATE.
- `update_my_profile` (`20260701000000_player_self_adjustment.sql:12-55`) —
  same, plus `adjustment` participates in the `playtomic_updated_at` freshness
  check.
- `self_signup_player` (`20250503000000_init.sql:1077-1130`, lines 1116,
  1123-1124) — INSERTs both.
- `supabase/seed.sql:36` — seed insert column list.
- `get_my_profile_v2` / `get_all_players_with_pii_v2` return `SETOF players`, so
  their row shape changes implicitly when the columns drop — no column list to
  edit, but client Zod schemas must not expect them.

All four write RPCs already `coalesce` the payload key and no client sends it,
so `adjusted_level` currently just mirrors `playtomic_level` (D-018).
`learned_rating` / `learned_rd` / `learned_matches_count` drop in the same
change; `glicko2.js` and `ratingsRecompute.js` are their only remaining writers.
