# Matchmaking V2 — Decision Log

Append-only. One entry per decision that changes DESIGN.md, freezes/unfreezes a
contract, or resolves an open question. Newest at the bottom. Reference entries
as `D-00N` from code comments, PRs, and the other docs.

Format:

```
## D-00N — Title (YYYY-MM-DD)
**Decision:** what was decided.
**Why:** the reasoning, including rejected alternatives if instructive.
**Impact:** which docs/contracts/tasks change.
```

---

## D-001 — Scope: replace the Lobster/Americano path only (2026-07-08)

**Decision:** V2 replaces only the annealed Lobster generator. The other
generators in `scheduleHelpers.js` (Americano-simple, Mexicano, RoundRobin,
legacy Lobster) and `pairingEngine.js` are not ported — only Americano events
have ever been run. They are deleted at cutover (Phase 4).

**Why:** No real usage; porting them would multiply the cost model and test
surface for zero users.

**Impact:** DESIGN.md scope note; Phase 4 deletion list.

## D-002 — Drop `adjustment`; self-edit resets the prior (2026-07-08)

**Decision:** The `players.adjustment` / `adjusted_level` mechanism (including
the recent player-self-adjustment feature, migration `20260701000000`) is
deprecated and dropped at cutover. The only level inputs are the self-reported
`playtomic_level` and learned match data (`mm_rating`/`mm_sigma`). When a
player edits their Playtomic level, the prior re-anchors: `mu ← new level`,
`sigma ← 0.7`, logged as a `rating_events` row with `kind = 'self_reset'`.

**Why:** Two independent mechanisms moving a player's effective level
(self-adjustment and the learning loop) would fight each other with no defined
precedence. A self-edit means "your data about me is stale" — believe it, but
drop back to low confidence so results re-verify it quickly.

**Impact:** DESIGN.md §2, §5 (rating_events gains `kind`, nullable
`tournament_id`); `update_my_profile` RPC change (task M3.3); Phase 4 column
drops.

## D-003 — Numeric defaults blessed as starting points (2026-07-08)

**Decision:** Guardrail cap 0.30/event, sigma court-spread slack `+sigma/2`,
sigma prior 0.7 / floor 0.15 / inactivity +0.02/month, and the preset knob
table are accepted as starting values. Mid-event dropout regeneration is out
of scope.

**Why:** Owner review 2026-07-08: values sound reasonable; expect to iterate
after calibration (§6) and the first live events rather than analyse further
up front.

**Impact:** DESIGN.md §9 rewritten as "open items"; calibration tasks retune
these rather than debate them.

## D-004 — Docs restructure + multi-model workflow (2026-07-08)

**Decision:** Design/plan/decisions live in `docs/matchmaking-v2/` as
DESIGN.md / PLAN.md / DECISIONS.md. Implementation uses a coordinator model
(Fable/Opus) that owns contracts, numerics, and search correctness, delegating
contract-bounded modules to worker models (Sonnet). Contracts-first: each
phase starts by freezing types/signatures/test specs before any worker task.

**Why:** Work will span many chat sessions and models; intent must survive in
the repo, not in any conversation. Worker models are reliable exactly when
scope is a frozen contract plus acceptance tests.

**Impact:** PLAN.md session protocol; CLAUDE.md pointer.

## D-005 — Rating contracts: `infoPerMatch` param + skip-frozen acceptance tests (2026-07-10)

**Decision:** (1) The sigma update's per-match information gain (DESIGN §4.2
leaves `I` implicit) is an explicit calibration parameter `infoPerMatch`,
default `0.58`, chosen so five full-weight matches move a new player's sigma
0.70 → ≈0.45 as §4.2 promises. It joins `levelScale` (D), `perfNoise` (beta),
`learnScale` (G), and `nRef` in `RatingParams`; all defaults are provisional
until M1.6. (2) M1.1's "failing test files" are delivered as complete
assertion suites wrapped in `describe.skip`, one per task (M1.2–M1.5); the
implementing task removes only the `.skip`. This keeps `main` green (PLAN §2)
while still freezing every acceptance test. Changing a frozen assertion
requires a DECISIONS entry, same as any contract change.

**Why:** The sigma formula is untestable without pinning `I`, and a named
param keeps it fittable in M1.6 rather than buried as a magic constant.
Literally-failing tests would contradict the "keep main green" ground rule the
moment M1.1 lands.

**Impact:** `types.ts` (`ratingParamsSchema`, `DEFAULT_RATING_PARAMS`);
M1.2–M1.5 test files; M1.6 fits `infoPerMatch` alongside the other constants.

## D-006 — N_ref corrected to 7 by the P0.1 audit (2026-07-10)

**Decision:** `N_ref` (reliability-weight normalizer, DESIGN §4.1) provisionally
becomes **7**, the median match point total observed independently in both
history sources (History.jsx n=116 and production `matches` n=174). The ≈24
figure in the original design is retired: History.jsx _tournament-total_ player
scores have median ≈21–22, so it was almost certainly anchored on the wrong
unit. M1.6 still fits the final value.

**Why:** With N_ref=24 a typical 7-point match would carry weight ≈0.29,
silently tripling the effective number of events needed for sigma convergence
and shrinking every delta — a units bug baked into a default.

**Impact:** DESIGN §4.1 text; `DEFAULT_RATING_PARAMS.nRef` in `types.ts`;
the M1.3 weight acceptance test now pins nRef explicitly instead of relying on
the default. P0.1 also flagged 16/68 unlinked historical names — an owner task
before M1.6, since unlinked names shrink the usable calibration set.

## D-007 — Explicit `Team` type: Zod 4 tuple inference breaks under non-strict tsconfig (2026-07-10)

**Decision:** `types.ts` defines `Team` as the literal `[string, string]` and
annotates `teamSchema` as `z.ZodType<Team>` instead of deriving `Team` via
`z.infer`. Runtime validation is unchanged.

**Why:** The repo compiles with `"strict": false`; Zod 4's static inference
requires strictNullChecks, so `z.infer` of the tuple degraded to
`[string?, string?, ...unknown[]]` — which only surfaced when M1.3 first
consumed tuple elements (the M1.1 stubs never touched them). Enabling strict
mode repo-wide is out of scope for this initiative.

**Impact:** `types.ts` only; no acceptance test changed. M2.1 must use the
same explicit-type pattern for any inference-sensitive schema (tuples,
optionals) it adds. Related tooling gap found the same session: `eslint.config.js`
matches only `**/*.{js,jsx}`, so no `.ts` file in the repo is linted — the
"lint passes" gate is currently vacuous for domain code (PLAN §6 watch item).
**Superseded by D-009** — with `strictNullChecks` enabled the workaround was
reverted and `Team` is `z.infer`'d again, exactly as originally frozen.

## D-008 — `admin_update_player` keeps its function, loses its `adjustment` writes (2026-07-10)

**Decision:** The admin manual level-override does not survive V2. At M3.3/M4.3
the `adjustment` / `adjusted_level` writes are removed from
`admin_update_player` (P0.3 found it shares those columns with the self-edit
path), but the RPC itself survives — it is the general admin profile-edit
endpoint (name, email, gender, playtomic_level, …). Owner confirmed 2026-07-10.

**Why:** Same reasoning as D-002: two mechanisms moving a player's effective
level would fight the learning loop with no defined precedence. Admins keep a
lever — the §4.3 flagged-adjustment review queue (approve/edit/discard
remainders) plus editing `playtomic_level` itself, which triggers the D-002
reset semantics.

**Impact:** M3.3 scope grows slightly (strip the two fields from
`admin_update_player` as well as `update_my_profile`); M4.3 column drops
proceed unchanged; PLAN Appendix B is the checklist.

## D-009 — `strictNullChecks` + TypeScript linting enabled repo-wide (2026-07-10)

**Decision:** `tsconfig.json` gains `"strictNullChecks": true` (full `strict`
stays off — 42 errors, a separate cleanup), and `typescript-eslint` is
installed with its recommended rules applied to `**/*.{ts,tsx}`.
`@typescript-eslint/no-explicit-any` is `warn` for now (68 pre-existing `any`s
in legacy TS); tighten to `error` as they're paid down. All 17 pre-existing
lint errors were fixed, so `npm run lint` is a real green gate again.

**Why:** Zod 4's static inference requires strictNullChecks — without it the
frozen rating contracts mis-inferred (D-007) and every future matcher schema
would too. The repo was only 3 errors away (one untyped `useState(null)` in
`useAuth.js`, fixed with a JSDoc annotation), so enabling it now was cheaper
than working around degraded inference for the rest of the initiative.

**Impact:** `tsconfig.json`, `eslint.config.js`, `package.json`
(+`typescript-eslint` devDep); `types.ts` `Team` reverted to the original
frozen `z.infer` form (D-007 superseded); PLAN §6 lint watch item resolved.
Follow-ups left open: full `strict`, `no-explicit-any` → `error`.

## D-010 — M1.6 calibration: adopt levelScale = 7, hold learning params (2026-07-10)

**Decision:** `DEFAULT_RATING_PARAMS.levelScale` (D) moves `6 → 7`; `perfNoise`
(β), `learnScale` (G), `nRef`, and `infoPerMatch` (I) stay at their D-003/D-006
blessed defaults. Fitted by replaying **228 real scored matches** (174 prod +
54 alias-resolved History) chronologically and minimizing Brier on point-share
predictions (`calibrate.ts`, pure; `calibrate.harness.test.ts`, dev-only,
skipped without `MM_CALIB_FIXTURE`). Deliverable: `calibration.md`.
**Phase 1 → Phase 2 gate MET:** V2 adopted Brier **0.0541** ≤ legacy Glicko-2
**0.0577** (parity, in fact better) on the same replay.

**Why:** `levelScale`'s Brier basin genuinely bottoms at 7–8 over 228 matches —
a real, if shallow, signal worth blessing. The full-grid optimum also nudged
β 0.5→0.3 and G 1→1.5, but that buys <0.001 Brier and is constrained by only
**6 event-transitions**: false precision. D-003 always anticipated tuning the
learning params on live events, so they stay conservative. Owner decision
(2026-07-10): the 16 unaliased History names can't be linked, so the fit leans
on production matches; 62 History matches (incl. all of the apr2026 ladies event
and standings-only jan2026) are dropped, not linked.

**Impact:** `types.ts` `DEFAULT_RATING_PARAMS.levelScale = 7` (frozen contract
change — this entry authorizes it). `update.test.ts`'s "advantage == levelScale
⇒ E = 10/11" test now pins `levelScale: 6` explicitly so the property is
independent of the default. New files: `rating/calibrate.ts` (+ `.test.ts`),
`rating/calibrate.harness.test.ts`; `expectedShare` extracted from `update.ts`
as a shared export. PLAN §6 "alias coverage gap" risk resolved (owner chose not
to link; fit proceeded on prod data). Learning-param retune tracked for Phase 4
live events (M4.2).

## D-011 — Unknown gender is exempt, never blocking (2026-07-13)

**Decision:** `PlayerInput.gender` is `male | female | unknown`; `''`/null
normalize to `unknown` at the service boundary. In mixed mode, a team
containing an unknown-gender player never counts as same-gender, and unknowns
offset the unavoidable same-gender quota: per round,
`quota = max(0, 2·courtsUsed − min(male, female) − unknown)`; rosters with
unknowns get an informational audit entry. In `men`/`women` modes gender never
blocks — mismatched or unknown genders produce an informational `gender-mode`
entry only.

**Why:** Production has 9/103 players with `''` or null gender (P0.2 finding).
Blocking would strand real rosters on data we know is dirty; penalizing
unknown-containing teams would fabricate evidence the data doesn't hold.
Rosters are admin-curated, so the audit's job is to surface, never veto.

**Impact:** `types.ts` (`playerGenderSchema`); feasibility contract + M2.2
tests (`sameGenderQuotaForRound`); mixedPreference scoring in M2.5/M2.6 tests;
PLAN §6 "gender data is not binary" watch item resolved.

## D-012 — Property testing via seeded sweeps; goldens via vitest snapshots (2026-07-13)

**Decision:** No fast-check dependency. Invariant suites use deterministic
case grids and seed sweeps driven by the domain's own injected mulberry32 RNG
(seeds pinned in the tests); small subproblems are verified against in-test
brute force (e.g. the M2.3 co-sit optimum). Golden tests (M2.10) are vitest
`toMatchSnapshot` runs of the full `ScheduleRun` for 3 rosters × 3 presets,
with committed snapshots.

**Why:** Reproduce-by-seed comes free from the engine's determinism contract —
a failing case is already a pinned seed, which removes fast-check's main win
(shrinking) while its generators would add a dependency and a second source of
randomness. The parameter space (8–32 players × 4–6 rounds × 0–4 lefties) is
small enough to sweep deterministically. Snapshots give reviewable committed
fixtures with zero harness code and a built-in update workflow.

**Impact:** All M2.2–M2.10 test files as frozen by M2.1; `golden.test.ts`
harness shape; PLAN M2.10 "commit golden fixtures" = commit the snapshot file.

## D-013 — Matcher contract clarifications made while freezing (M2.1, 2026-07-13)

**Decision:** Gaps DESIGN left implicit, pinned so the acceptance tests could
be frozen:

1. **`generate.ts` orchestrator** joins the §7 module map (implemented in
   M2.8): the pipeline is a domain concern and golden/shadow harnesses need a
   single entry point (`generateSchedule(input): ScheduleRun`).
2. **Quotas are enforced per round** from actual round composition
   (`leftyQuotaForRound`, `sameGenderQuotaForRound`); the event-level audit
   numbers are the reported relaxation plan, not the enforcement mechanism.
3. **Court-spread sigma slack:** `cap′ = maxCourtSpread + max(sigma on
court) / 2`, owned by `cost.ts`. The "sigma slack applied" acceptance moves
   M2.4 → M2.6 (banding uses mu + jitter only).
4. **§3.2 exchange-rate example corrected:** a 2nd opponent meeting
   (raw 0.5 × weight 0.6 = 0.3) equals a 0.15-level team-sum gap; a 3rd+
   meeting equals 0.3 levels. The original sentence double-counted.
5. **Report conventions:** rounds/courts 1-based; `violations.court` nullable
   (sit-out rules have no court); `quality` = `{ overall, perRound }`;
   player refs are full `PlayerInput` snapshots; quality rollup formulas
   frozen in the `report.ts` docblock.
6. **Canonicalization:** teams sorted by playerId with team1 lexicographically
   first; split candidates enumerated over the court sorted mu-desc/id-asc as
   [01|23], [02|13], [03|12]; cost ties pick the earliest candidate.
7. **Sequencing:** M2.6 lands before M2.5 (`teams` uses `cost.scoreSplit`);
   M2.9 lands before M2.8 (`generate` uses `resolveConfig`).

**Why:** Each is a point where two reasonable implementations would diverge —
exactly what the contract-freeze rule exists to prevent.

**Impact:** DESIGN §2, §3.1, §3.2, §3.4, §7 text updated; PLAN M2.4/M2.5/M2.6/
M2.8/M2.9 task notes; all matcher stub docblocks carry the pinned semantics.

## D-014 — Refine repairs quota-exceeding construction output (2026-07-13)

**Decision:** `refineSchedule` does not assume a hard-legal input. Stages 2–3
can exceed hard quotas (strict banding concentrates same-mu lefties onto one
court, forcing a double-lefty fallback; stable bands repeat partnerships), so
refine's acceptance rule is lexicographic: a move is accepted when it strictly
reduces total hard-quota violations (per-round double-lefty excess + event
partner-repeat excess), or keeps them equal and strictly reduces cost.
Sit-out rules (never consecutive, counts within 1) remain absolute move
filters — stage-1 plans are always sit-legal, so they never need repair.
While violations exist, refine proposes a targeted deterministic repair move
(enumerate lefty ↔ non-lefty swaps within the violating round, pick the
lexicographic best) before falling back to rng moves; random proposals alone
are too unlikely to find repairs within the budget. `refine.ts`'s contract
docblock is updated accordingly (this entry authorizes it); `generate.ts`
tracks `doublesUsed` against `leftyQuotaForRound` during construction and
relies on refine to repair any banding-forced excess.

**Why:** The frozen M2.7 acceptance suite (M2.1) feeds refine raw stage 0–3
construction output and asserts the _output_ is hard-legal — repair is the
contract, not an option. The alternative (making construction itself
hard-legal by re-banding around lefty concentration) would duplicate the
search inside stage 2 for no test-visible benefit. Empirically the golden
suite confirms all 9 roster × preset runs emit zero violations.

**Impact:** `refine.ts` (contract docblock + implementation), `generate.ts`
docblock note. No frozen test changed. Cost-non-increase still holds: repair
moves may transiently raise cost, but descent recovers within budget on every
frozen case (violating partnerships also carry the 5.0 partnerRepeat weight,
so repairs usually cut cost outright).

## D-015 — `balanced` preset socialDial 0.35 → 0.5 (2026-07-13)

**Decision:** The `balanced` preset's `socialDial` (J) moves `0.35 → 0.5` in the
frozen `PRESET_KNOBS` table (`presets.ts`). No other knob or weight changes;
`competitive` (J=0) and `social` (J=0.8) are untouched.

**Why:** The M2.11 shadow comparison (`shadow-report.md`) ran V2 against the
legacy annealed matcher on two real anonymized rosters and included a
balance↔variety re-tuning frontier. Raising J to 0.5 is a near-Pareto
improvement at these field sizes: extra banding jitter breaks up
repeat-opponent clustering _before_ the court-spread cap binds, so both balance
and opponent variety improve (Event A: repeat-opponent pairs 14→10, Balance
91.6→93.8%, Variety 91.7→92.7%; Event B: 17→12, Balance 89.4→90.9%, Variety
85.4→87.5%). Raising the opponent-repeat _weight_ instead was rejected — it
costs balance for less variety gain. Minor side effect: mixed-mode gender
preference dips slightly on the fuller field (Event A genderPreference
93.8→89.6%), well within tolerance and never a hard rule. Owner approved
2026-07-13. This entry authorizes the change to the M2.1-frozen knob table.

**Impact:** `presets.ts` `PRESET_KNOBS.balanced.socialDial`; the three pinned
assertions that hard-coded 0.35 (`presets.test.ts` ×2, `generate.test.ts` ×1)
updated to 0.5 (this entry authorizes them); the three `× balanced` golden
snapshots regenerated (`__snapshots__/golden.test.ts.snap`); `shadow-report.md`
regenerated with balanced = J=0.5. Phase 2 → Phase 3 gate met: owner reviewed
the shadow report and approved proceeding.

## D-016 — V2 tables write through `require_admin()` RPCs; `matches` keeps delete+insert (2026-07-13)

**Decision:** The new Phase 3 write surfaces — `players.mm_*` updates,
`rating_events`, and `schedule_runs` — go through `require_admin()` RPCs
(`admin_apply_tournament_ratings`, `admin_review_rating_event`,
`admin_record_schedule_run`) per DESIGN §5, **not** the RLS-gated direct table
writes that `matches`/`settings` use today (P0.2). `matches` is the deliberate
exception: schedule (re)generation keeps its existing full `DELETE` +
`INSERT` via `saveMatches` (direct, RLS-gated), and score entry keeps its
in-place `UPDATE` by stable `id`. This resolves the §6 "RPC vs direct-write
mismatch" watch item.

**Why:** The rating surfaces have integrity and atomicity requirements
`matches`/`settings` never had, so the direct-write precedent is the wrong
model to copy:

- **Multi-row atomicity.** Applying one tournament's ratings updates N
  `players.mm_*` rows _and_ inserts N `rating_events` rows all-or-nothing; a
  direct-write client does this as 2N un-transacted round-trips with
  partial-failure risk. An RPC is one transaction.
- **Server-enforced invariants RLS cannot express.** RLS gates _who_ writes,
  never _what_: `applied_delta` must equal the guardrail-capped
  `proposed_delta`; `review_status` may only move `null → approved/edited/
discarded`. Direct writes let any admin-JWT client tamper with either. The
  RPC enforces them.
- **Computed, not form, payloads.** These rows are the domain engine's output
  (caps, flags, breakdown jsonb), validated at the RPC boundary rather than
  trusted from the client.
- The `require_admin()` helper and `admin_*` RPC pattern already exist (RBAC
  migrations), so this is reuse, not net-new plumbing.

`matches` stays direct delete+insert because none of those pressures apply and
one design coupling actively favors it:

- **Nothing references a match `id` durably** — no FK targets `matches`, scores
  live on the row itself, and no V2 table links to a match row (`rating_events`
  keys off `tournament_id` + `player_id`; the per-match breakdown is a jsonb
  blob; `schedule_runs` is an unlinked audit record). There is nothing to
  preserve an id _for_, so a diff/upsert buys nothing.
- **Delete+insert is load-bearing for realtime.** `matches` is the sole table
  left in the `supabase_realtime` publication
  (`20260602000001_trim_realtime_publication.sql`), kept published for schedule
  INSERT/DELETE liveness; peers rebuild the schedule view from those events
  (score sync rides a separate Broadcast path). Switching to diff/upsert would
  break peer schedule-sync and re-add per-subscription WAL/RLS cost on the one
  table that migration deliberately trimmed to.

**Consequences / notes:**

- `schedule_runs` is written at **commit time** (bundled with the `matches`
  persist in M3.2's `generateSchedule.service.ts`), not on throwaway preview
  generations. It is an audit blob, intentionally **not** transactionally tied
  to the `matches` rows it describes — acceptable non-atomicity for a
  provenance record; the two use different write mechanisms anyway.
- **Revisit trigger for the `matches` exception:** if a future table gains a
  foreign key to an _individual_ match row (e.g. per-match rating events instead
  of a tournament-level blob, or match-level media), reconsider id stability
  then — not before.
- **Out of scope, flagged separately:** regenerating after scores are entered
  currently wipes them (`saveMatches` re-inserts with null scores). This is a
  product/UX behavior question orthogonal to id stability, owned by M3.5, not
  addressed here.

**Impact:** DESIGN §5 (confirms the RPC pattern; adds the `matches` exception
note); PLAN §6 watch item resolved (ref D-016); M3.1 (build the three RPCs +
SQL auth tests), M3.2 (services call RPCs for ratings/runs, keep `saveMatches`
for `matches`).

## D-017 — `mm_*` is admin-only: redact it from `get_my_profile_v2` (2026-07-14)

**Decision:** `mm_rating` / `mm_sigma` / `mm_rating_updated_at` are never exposed
to a player, including their own row. `get_my_profile_v2()` (the self-profile
RPC, `SECURITY DEFINER`, `SELECT *`) is rewritten to null those three columns in
its returned row; it keeps its `RETURNS SETOF players` signature (the row shape
is unchanged — the columns come back `NULL`), so no client schema/type change is
needed. Admin visibility is preserved: `get_all_players_with_pii_v2()`
(`require_admin()`-gated) still returns the real values, and `players_public`
already omits `mm_*` via its explicit column list. Realized now (pulled forward
from the M3.4/M4.1 deferral) at the owner's request.

**Why:** DESIGN §5 specifies "admin-only visibility" for the learned rating.
After M3.1 added the columns, `get_my_profile_v2`'s `SELECT *` transmitted a
signed-in player their own `mm_*` over the wire (never others' — RLS + the
admin-only `rating_events`/`schedule_runs` policies hold). The learned number is
internal engine state, not a player-facing score; leaking even one's own invites
confusion and gaming. Nulling the columns in-place (vs. narrowing the return type
to a custom composite) is the minimal, non-breaking fix: it keeps `SETOF players`
so `myProfileRowSchema` and every caller are untouched, and a rowtype-variable
redaction is robust to future `players` columns. The §6 watch item explicitly
flagged the return-type change as the reason to defer — nulling sidesteps it.

**Impact:** new migration `20260714000001_mm_admin_only_profile.sql` (redefines
`get_my_profile_v2`); PLAN §6 "`mm_*` self-visibility" watch item resolved
(ref D-017); no client code change (M3.2 services + `myProfileRowSchema`
unaffected). M4.1 seeding can populate `mm_*` without exposing it.

## D-018 — M3.3 keeps `adjusted_level` mirroring `playtomic_level` (2026-07-14)

**Decision:** In M3.3, `update_my_profile` and `admin_update_player` stop writing
`adjustment` and drop the `+ adjustment` term, but **keep writing
`adjusted_level = <new playtomic_level>`** (i.e. treat adjustment as 0 on the
edit path) rather than dropping the `adjusted_level` write outright as D-008's
letter suggested. Both RPCs additionally reset `mm_rating`/`mm_sigma` and log a
rating event when `playtomic_level` actually changes: `update_my_profile` →
`kind = 'self_reset'`, `admin_update_player` → `kind = 'admin_edit'` (D-008: an
admin level edit triggers the same D-002 reset semantics). The reset + audit
insert is a single shared `record_mm_reset()` SECURITY DEFINER helper
(execute revoked from anon/authenticated/public — internal to the two RPCs).

**Why:** `adjusted_level` is still read by ~13 display sites (P0.3 Appendix B
"client reads") until M4.3 migrates them to `mm_*`/`playtomic_level`. Dropping
its write in M3.3 would show an edited player their _old_ level badge for the
whole M3.3→M4.3 window — a real regression for one free line. Mirroring
`playtomic_level` is the correct "no adjustment" value and keeps display
faithful; the column and this write both still disappear at M4.3, so the drop
proceeds unchanged (D-008 Impact holds). The self-_adjustment_ mechanism itself
is gone: `adjustment` is no longer read or written by either RPC (D-002).
`record_mm_reset` is extracted rather than inlined twice (CLAUDE.md de-dup rule)
and single-sources the `applied_delta = new_level − prior_mu` audit arithmetic.

**Impact:** new migration `20260714000002_mm_self_reset_hook.sql`
(`record_mm_reset` helper + both RPC redefinitions); realizes M3.3. Client
`updatePlayer` still sends an `adjustment` key (now ignored by the RPCs) — its
removal is M4.3 UI work per Appendix B. `admin_add_player`/`self_signup_player`
still write `adjustment`/`adjusted_level` (out of M3.3 scope; dropped at M4.3).
`rating_events` gains real `self_reset`/`admin_edit` rows. M4.3 checklist:
`record_mm_reset` stops writing `adjusted_level` when the column drops.
