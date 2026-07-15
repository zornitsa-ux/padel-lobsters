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

## D-019 — Phase 3 admin UX: deepen the existing flow (2026-07-14)

**Decision:** The M3.4 admin UI **extends the current Schedule-tab flow rather
than replacing it**, keeping the four beats admins already know — configure →
generate → review the preview → save — and making each beat smarter. Settled
from an owner-reviewed UX sketch (mobile mockups; shape approved, only spacing
noted). Five product forks resolved:

1. **Rollout visibility → silent swap.** With the M3.5 flag on, the Lobster
   generation path _is_ V2; no user-facing "old/new matcher" toggle or beta
   label. The reworked config card is the only visible change. (Rejected: labeled
   beta tag; explicit per-event engine toggle — both invite per-generate
   second-guessing for no benefit once the flag is the gate.)
2. **Config depth → preset + collapsed "Advanced".** The three presets
   (Competitive / Balanced / Social) are always visible; the advanced knobs
   (`socialDial`, `maxCourtSpread`, `maxPartnerGap`, `balanceTolerance`,
   `leftyRule`) live behind one disclosure, with the auto-generated exchange-rate
   sentences (`presets.exchangeRateSentences`) shown as helper text inside.
   (Rejected: presets-only, which loses per-event nudging; everything-open, too
   heavy for a normal event.)
3. **Quality report → inline on the preview.** The overall grade + the five
   `QualityDimensions` bars (balance, partnerFairness, variety, sitoutFairness,
   genderPreference) render atop the preview; per-round breakdown and the
   violations list sit behind a disclosure. Seen on every generate, no detour.
   (Rejected: separate Report tab, out of the save-path sightline; collapsed-by-
   default, which hides the "explainable" payoff.)
4. **Iteration → Reshuffle + Compare-two.** Reshuffle re-seeds and replaces the
   preview (today's model). Additionally, **Compare** generates one alternate
   (different preset or seed) and shows the two ScheduleRuns side-by-side as
   comparable grades to pick a winner — leaning into the design's "directly
   comparable" promise. (Rejected for now: an N-candidate gallery — heaviest
   build, deferred to post-cutover if wanted.)
5. **Rating review home → in the Finish flow.** "Finish tournament" → apply
   ratings → review screen, in one motion while context is freshest. Small moves
   auto-apply (±cap); only clamped/flagged events queue, each with its per-match
   breakdown and Approve / Edit / Discard. (Rejected as the _primary_ home: a
   standing "Ratings" admin area — another place to remember to visit; the
   badge+deep-link hybrid can be added later if reviews start piling across
   events.)

Also feasibility (Stage-0 audit) is surfaced **before** generation as preflight
chips on the config card, not only inside the post-generation report.

**Why:** The current flow works and admins have muscle memory for it; the only
genuinely new literacy V2 demands is reading a quality bar, so the design spends
its novelty budget there and nowhere else. Progressive disclosure keeps the
power (dials, per-round detail, comparison) one tap away without cluttering a
normal Saturday generate. The rating queue is deliberately quiet — it speaks up
only for the 1–2 players per event the model is unsure about, matching the
"auto-apply small, review large" governance in DESIGN §4.3. Component-level
polish (per-round breakdown layout, the Edit-remainder modal, empty/first-run
states) is intentionally deferred — cheap to iterate on the live first-cut once
the shape is in.

**Impact:** DESIGN §7 UI module intent confirmed (`ConfigPanel`,
`SchedulePreview`, `QualityReport`, `RatingReview`) and clarified — `ConfigPanel`
owns the preset segmented control + Advanced disclosure + preflight feasibility
chips; `SchedulePreview` owns per-court sums/spread/flags + Reshuffle/Compare;
`QualityReport` renders inline (grade + 5 bars + violations, per-round behind a
disclosure); `RatingReview` mounts inside the Finish flow. M3.4 tasks build to
this shape (manual verify + typecheck, no domain logic in UI). M3.5 flag = silent
V2 swap on the Lobster path. Compare-two is in M3.4 scope; N-candidate gallery is
explicitly out. UX sketch is a throwaway exploration artifact — not committed.

---

## D-020 — Lobster is the only format; the select goes away (2026-07-15)

**Decision:** The app supports **exactly one event format: `lobster_matching`**.
M4.3 removes the format select from `EventFormModal.jsx` rather than trimming it
to a shorter list, and removes the multi-format branching behind it. If a second
format is ever wanted, it gets built deliberately — as a real generator with a
real UI — rather than kept alive as a standing option that mostly doesn't work.
Owner call, 2026-07-15: "We have no plans for other formats. I'd rather get
things cleaned up and we can expand again later if we need."

**Why:** The list is already fiction (M3.6 Finding 2). Production has used
`lobster_matching` for **6 of 6 events** and nothing else, ever. `knockout` is
offered with no generator at all — it silently falls through to Americano.
D-001 deletes the americano/mexicano/roundrobin generators at M4.3, which would
turn their three options into the same silent trap. So the select cannot survive
M4.3 in its current form regardless; the only open question was whether to trim
or to cut, and there is no evidence for anything to trim _to_. Keeping dead
options costs real money: every one is a branch in `handleGenerate`, a
`|| 'americano'` default in three files, a label map, and a rounds picker that
V2 has to keep reasoning about.

**Impact:** M4.3 scope grows to include: the select
(`EventFormModal.jsx:97-101`), `formatLabel` (`eventHelpers.js:20-26`), the
`format` branch (`Schedule.jsx:332-350`), the `|| 'americano'` defaults
(`eventConstants.js:16`, `Tournament.jsx:94`, `Registration.jsx:114`), and the
`!isLobster && (americano|mexicano)` rounds picker
(`ScheduleGeneratorControls.tsx:71`). With one format, `isLobster` stops being a
condition and collapses out of `Schedule.jsx` — including the `useV2Matcher`
guard, which reduces to `v2Enabled && isAdmin`. Data: all 6 existing rows are
already `lobster_matching`, so no backfill is needed; add a CHECK constraint (or
default-and-drop the column) so the DB stops accepting formats the app can't
generate — `tournaments.format` is bare `text default 'americano'` today
(`init.sql:69`), a default that will itself be wrong once Americano is gone.
Supersedes nothing; extends D-001 from "delete the unused generators" to "delete
the concept of format choice."

---

## D-021 — Exchange rates out; preset intent + tie-break order in (2026-07-15)

**Decision:** Delete `exchangeRateSentences` and replace it with two things:

1. **`PRESET_INTENT`** — a one-line, plain-language statement of what each
   preset is for, rendered **always-visible under the preset control**, not
   behind Advanced. Static copy co-located with `PRESET_KNOBS` so retuning a
   preset forces a look at whether the promise still holds.
2. **`matcherPriorities({ config })`** — the five quality dimensions ranked by
   how hard the matcher protects them, rendered inside Advanced as "when it
   can't satisfy everything, the matcher protects these in order — the last ones
   give first."

Owner call, 2026-07-15 (M3.6 Finding 5): reframe rather than cut, plus surface
per-preset intent outside the Advanced disclosure.

**Why:** The sentences exposed the cost model's own units to admins — every one
read "…costs as much as a 0.42-level team-sum gap", a conversion between two
abstractions, one of which (_team-sum gap_) the UI never defines. That breaks a
**D-019 premise**: V2 budgets for admins learning _one_ new thing (reading a
quality bar) and spends novelty "there and nowhere else". Exchange rates were a
second, harder, unbudgeted literacy. They were also **non-actionable**: four of
the six described weights (`opponentRepeat`, `partnerRepeat`, `mixedPreference`,
`sitGroupOverlap`) that no Advanced knob can change.

**The ranking is preset-invariant, and that is why the two pieces are separate.**
Ranking by weight yields the identical order for all three presets
(`variety > balance > partnerFairness > sitoutFairness > genderPreference`;
verified numerically and pinned by a test) because presets differ in
`socialDial`/`maxCourtSpread` — banding tightness — not in weights. A
"this preset gives up X first" list would therefore look dynamic and never
change, which is worse than the sentences it replaced. So the ranked list is
framed as an **engine** explainer (fixed, inside Advanced) and `PRESET_INTENT`
carries the **preset** difference (always visible). Comparing weights directly is
legitimate: every dimension's cost is weight × a normalized unit (DESIGN §3.2),
so one unit of each concession is the same size and the weight _is_ the exchange
rate — the same identity the deleted sentences were built on, minus the
arithmetic.

**Impact:** Two frozen contracts change (coordinator-made, per the §1 freeze
rule). Matcher domain: `exchangeRateSentences` removed; `PRESET_INTENT`,
`matcherPriorities`, and the `MatcherPriority` type added to `presets.ts`.
ConfigPanel props (frozen at M3.4): `exchangeSentences: string[]` → `presetIntent:
string` + `priorities: MatcherPriority[]`. The M2.9 exchange-rate acceptance
specs are replaced by matcher-priority specs incl. a grouping test asserting
`matcherPriorities` sums weights exactly as `report.ts:40-44` derives the bars —
the list and the bars can never name different things. New `ui/dimensions.ts`
holds the one dimension vocabulary, consumed by both `QualityReport` and
`ConfigPanel` (D-019's one-literacy rule, enforced structurally). No engine
behavior changes: weights, costs, and goldens are untouched — this is presentation
only. The deeper "show consequences, not descriptions" option (re-run on dial
change, show bar deltas) stays deferred; it depends on Finding 4's deferred
generation landing first.

---

## D-022 — Admin copy speaks padel, never the cost model (2026-07-15)

**Decision:** All matchmaking admin copy describes **what a player would notice
on court**, in Playtomic levels. The cost model's vocabulary is banned from the
UI: no "free", no "excess", no "units" of anything, no weights, no exchange
rates, no "counts against". Where a setting has a level threshold, the copy
shows a worked example in levels ("a 3.0 sharing a court with a 4.3"). Where it
has no honest level meaning, the copy says what you trade and shows no number.
Owner call, 2026-07-15, on the third iteration of the same failure.

**Why:** This is the third time the model's mental furniture leaked into an admin
surface, each time one level less obvious. D-021 removed exchange rates ("0.42-
level team-sum gap") and replaced them with thresholds described as "free" and a
"unit of imbalance" — the same mistake in plainer words. Owner: "I don't know
what it means for the levels to be free… What is a unit of imbalance?" The tell
is that each rewrite felt concrete _to someone holding the cost function_.
"Free" is only meaningful if you know costs accrue on excess; "one unit" is only
meaningful if you know dimensions are normalized. Both encode `cost.ts` and
neither survives contact with an organizer. The target reader plays padel and
reads Playtomic levels; they do not have a cost function and are not going to
acquire one.

**Rule of thumb for future copy:** if a sentence cannot be checked by picturing a
court, it is wrong. "A 3.0 can end up with anyone from 2.0 to 4.0" is checkable.
"A 0.5-level team gap counts as one full unit of imbalance" is not.

**Impact:** `NUMERIC_KNOBS` in `ConfigPanel.tsx` carries `describe` (what this
setting does now) + `effect` (what you give up), both rewritten; the rule is
recorded in a comment on the type so the next editor sees it. Worked examples
anchor on `EXAMPLE_LEVEL = 3.0` and format through one helper, so the stated gap
and the example levels can't disagree (they did: "about 0.75 levels apart — a
3.0 with a 3.8", and "about 1 levels apart"). Two accuracy fixes fell out of
reading the rendered strings rather than the code: `socialDial = 0` claimed "a
3.0 is always with other 3.0s" when a strict sort actually seats you with the
_nearest_ levels, and `balanceTolerance` now carries **no worked number** on
purpose — it is a divisor, not a threshold, so any number reads as an allowance
and means the opposite of the truth. The D-021 priority list is reworded on the
same rule. Presentation only; no engine change. The deferred "show consequences"
work (dial moves → bars move) is the real fix and makes most of this copy
redundant when it lands.
