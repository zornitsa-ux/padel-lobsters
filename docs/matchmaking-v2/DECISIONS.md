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

---

## D-023 — Compare becomes a focused Alternatives view (2026-07-15)

**Decision:** Replace the inline compare-two panel with an **Alternatives view**:
a focused, full-screen task (not a small modal) that generates candidate
schedules, shows each as a card with its grade, the five bars, and a
plain-English diff against the current schedule, and ends in Keep / Use. It
absorbs Reshuffle as a special case. Owner call, 2026-07-15, rejecting the
current flow outright (M3.6 Finding 8).

**Open decision point — deliberately not settled now.** _Which_ candidates the
view offers is undecided: all three presets + a reshuffle of the current one, a
subset, or an admin-chosen set. Owner: "I'm not sure we'll automatically do all
the options you've suggested. We can decide that when we get there." Decide at
build time and amend this entry — do not infer it from the shape.

**Why:** Three separate failures, not one (all confirmed in code). _Placement:_
`ComparePanel` rendered at the top of `SchedulePreview` while its button sat at
the bottom under the full round list, so on mobile the comparison appeared
entirely off-screen — the owner found it only by accidentally scrolling up.
_Provenance:_ `handleCompare` silently re-seeded the same preset, so both columns
labelled themselves "balanced" and differed only by a raw seed integer; the admin
never chose the comparison and was never told what it was. _Shape:_ a passive A/B
of two grades is not a task. The deeper miss is that compare only ever answered
"is a different **shuffle** better?", while the question admins actually have is
"is a different **preset** better?" — which the old flow could not express at
all.

This supersedes D-019's compare-two decision and revisits its rejection of an
N-candidate gallery. That rejection was made on build cost; the cheaper thing was
built and failed in use, which is evidence rather than opinion.

**Impact:** `SchedulePreview`'s `compareRun`/`onCompare`/`onPickRun`/
`onCancelCompare` props and `ComparePanel` all go when the view lands.
**Sequencing:** blocked on M3.6 Finding 4 (deferred generation), now landed —
the view generates several schedules at once, which under the old synchronous
click would have frozen the main thread for seconds with no spinner. The
plain-English diff must follow **D-022** (say what a player would notice: "2
fewer repeat opponents", never cost deltas).

**Resolution (2026-07-23) — shape locked; the open decision point is closed.**
Owner steered the "which candidates" question to a concrete answer: the view does
**not** auto-generate a preset gallery. It compares **exactly two** schedules —
the **frozen original** (the current preview) and **one admin-built alternative**
— and the admin composes the alternative with the _same_ config UX used for the
first generation (preset picker + Advanced knobs), then generates/regenerates it.
This is a stronger read of D-023's own diagnosis ("the admin chooses what is
being compared"): rather than the app guessing candidates, the admin authors the
one comparison they care about. Confirmed forks (owner, 2026-07-23):

- **Container:** a **full-screen overlay** over the Schedule tab (not a router
  route, not `components/ui/Modal.tsx` — that is a `max-w-lg` bottom sheet, too
  narrow). Keeps `MatchmakingContainer` state alive underneath, so "Keep
  original" is a pure dismiss and the original is never at risk.
- **Layout:** the two **reports** (compact grade + five bars) sit **side-by-side**
  at the top for the at-a-glance compare, with a plain-English diff line
  (D-022 wording, derived from the five dimensions — no cost deltas). The bulky
  **rounds** are **stacked** — full Original section, then full Alternative
  section — never two columns of court cards (unreadable on mobile, the D-019
  target).
- **Original is immutable inside compare.** No regenerate/reshuffle affordance on
  the original side; it is preserved verbatim for "Keep original".
- **Alternative is fully re-configurable** via `ConfigPanel` bound to a _separate_
  `altConfig` (a `ScheduleRun` carries only resolved `config` + `seed`, not the
  user-facing `MatchConfig`, so the alt needs its own `MatchConfig` state).
  **The admin owns generation — the app never auto-generates.** Opening compare
  seeds `altConfig` from the current config and opens on an _empty_ alternative
  pane; the admin picks settings and clicks Generate alternative themselves.
  (Owner correction, 2026-07-23: an earlier cut auto-generated one alternative on
  open, which took the choice away from the admin — reverted.) A same-settings
  regenerate _is_ a reshuffle, so Reshuffle is covered without a separate button,
  but only when the admin asks for it.
- **No automatic scrolling.** The overlay does not scroll the alternative (or any
  section) into view on generation — the owner found the auto-scroll nauseating
  (2026-07-23). Arrival is announced via an `aria-live` region only.
- **Exit:** **Keep original** (dismiss, original preview untouched) or **Use
  alternative** (promote `altRun` → `preview`, dismiss; disabled until an
  alternative exists). "Use alternative" does **not** auto-save — the admin still
  Saves from the main preview through the existing score-guard flow.
- **Standalone Reshuffle button is removed** from `SchedulePreview` (its
  "different shuffle?" question is now answered inside Compare via an
  admin-triggered same-settings regenerate); the action row becomes Compare +
  Save. Finding 7's secondary-button restyle already landed (`60e6208`), so the
  remaining Compare button reads correctly.

**Contract changes (coordinator-made, per §1 freeze rule):**
`SchedulePreview` loses `compareRun`/`onPickRun`/`onCancelCompare`/`comparing`/
`onReshuffle`/`reshuffling`; keeps `onCompare` (now = open the overlay). New
presentational `ui/CompareView.tsx` and `ui/ScheduleRounds.tsx` (round rendering
extracted from `SchedulePreview` and shared by both). `ConfigPanel` gains one
optional `generateIdleLabel?: string` (default "Generate schedule"; the alt
passes "Generate alternative" / "Regenerate alternative"). `ui/dimensions.ts`
gains a pure `describeQualityDiff`. Container owns the new session state
(`comparing`, `altConfig`, `altRun`, alt busy flag) and the config derivations
extracted to a reusable `useConfigDerivations` hook (used for both primary and
alt). No engine/domain behavior change — presentation + wiring only.

## D-024 — Schedule flags become plain-language, per-player marks (2026-07-23)

**Decision:** Replace the raw court-flag chips (`high-sigma-player`,
`opponent-rematch` printed verbatim) with admin-legible cues, and move the
uncertainty signal from the court onto the specific player. Resolves M3.6
Finding 6 (D-022 violation — raw flag strings). Owner steered the wording:
"the badge isn't clear who it's referring to, and we don't want math jargon."

- **`high-sigma-player` → per-player 🌱 mark**, rendered next to the player's
  name exactly like the lefty 🤚 (title "Level still being learned"), derived
  in the UI from the persisted `player.sigma ≥ PROVISIONAL_LEVEL_SIGMA` (0.5).
  This answers "who?" — the old court-level chip never named anyone.
- **`opponent-rematch` → "Repeat opponents"** chip via a UI flag→label map,
  the one-vocabulary pattern from `ui/dimensions.ts`.
- **A legend ("Key:")** heads the schedule, listing only the marks that
  actually appear (🤚 left-handed, 🌱 level still being learned, Repeat
  opponents), so admins can read the marks without a data dictionary.

**Why the domain changed (departure from Finding 6's "UI-only" note).** Finding
6 warned against _renaming_ flags in `report.ts` because the strings are
persisted in the `schedule_runs` report blob (D-016) and a rename breaks
historical rows. Moving the signal per-player is different from a rename:
`buildScheduleRun` **stops emitting** `high-sigma-player` (the constant is
renamed `HIGH_SIGMA_FLAG_THRESHOLD` → `PROVISIONAL_LEVEL_SIGMA`, kept for the
UI threshold), and the UI derives the 🌱 mark from `player.sigma`, which is
also persisted. Historical rows therefore render identically: `ScheduleRounds`
drops the legacy `high-sigma-player` chip via `visibleFlags` and shows the
per-player mark from their stored sigma. `opponent-rematch` is left in the
domain untouched (still emitted) and mapped only at render time — no
persistence risk.

**Impact:** `domain/report.ts` (no high-sigma flag; renamed threshold + doc),
`domain/report.test.ts` (drops the obsolete court-flag test), `ui/ScheduleRounds.tsx`
(per-player mark, legend, flag→label map, legacy-flag filter). Applies
everywhere schedules render — `SchedulePreview` and `CompareView` both delegate
to `ScheduleRounds`. No engine behavior change.

## D-025 — Scale mark replaces 🌱; rematch chip names the exact pair (2026-07-23)

**Decision:** Two follow-on tweaks to D-024's admin-legible marks, both owner
feedback on the same session's UI:

- **🌱 → 📏** for the provisional-level mark. 🌱 read as "new/growing," not
  "measurement still settling"; a scale better fits "we don't trust this
  number yet."
- **"Repeat opponents" chip → named pair.** The generic chip told the admin
  a court had a rematch but not who; the chip now reads e.g. "Priya vs Sam —
  repeat," naming the specific opposing pair that's meeting again.

**Why UI-only again.** Same reasoning as D-024: the exact rematching pair is
derivable at render time from `court.teams`, which has always been persisted
per court. `ui/ScheduleRounds.tsx` now walks `rounds` once, replaying the same
meeting-count logic `report.ts` uses internally (`pairKey` + a running count),
and attributes each pair that hits its 2nd+ meeting to the court it recurs on.
The domain's `opponent-rematch` flag is untouched and still emitted — the UI
simply stops reading it, so historical `schedule_runs` rows (which only ever
had the boolean flag, not named pairs) render identically since the pair
identity was always recoverable from `teams`.

**Impact:** `ui/ScheduleRounds.tsx` only (`rematchesByCourt` helper, per-court
named chips, legend wording). No `domain/report.ts` or schema change, no test
changes outside this file (it has no dedicated test yet). No engine behavior
change.

## D-026 — Admin manual opponent-swap on the schedule preview (2026-07-23)

**Decision:** Add an admin control (M3.8, "Option A") that, on any court where an
opposing pair is meeting again, offers same-round player swaps that break that
specific rematch without dramatically unbalancing the court. The admin clicks a
"Fix" affordance on a repeat chip, is shown a short ranked list of concrete swaps
("Swap Dana for Priya — no new repeats, balance barely moves"), and picks one;
the preview rebuilds in place. A pure domain engine (`domain/swaps.ts`,
`suggestOpponentSwaps`) enumerates candidates, filters to hard-legal +
balance-safe, ranks by variety then balance, and returns each with a fully
rebuilt `ScheduleRun`. Scope is deliberately narrow: swaps between two
currently-playing players in the same round only.

**Why this doesn't violate DESIGN §2 "no admin pair overrides."** That principle
bars _persistent, generator-level_ pair inputs — cross-event memory, cohort
spreading, "always/never pair these two" rules that the matcher would carry
forward. A one-off, post-generation hand-edit of a single previewed schedule is a
different thing: it changes only this run, feeds nothing back into ratings or
future generations, and is re-scored by the same cost model the generator uses.
The admin is editing an artifact, not steering the engine.

**Correctness constraints (why the engine, not per-round UI patching):**
opponent- and partner-repeat costs accumulate chronologically (`cost.ts`,
`report.ts`), so a swap in round R changes flags/quality for R **and every later
round**. Any swap therefore reconstructs the working `Schedule`, applies the move,
and re-runs `buildScheduleRun` over the whole thing — a single round cannot be
patched in isolation without the badges lying. Legality reuses `hardViolations`
(now exported from `refine.ts` — no behavior change). The stage-1 sit-out baseline
is recomputed deterministically from the run's seed + roster
(`baselineCoSitOverlapFor`), so sit-out fairness stays byte-identical (Option-A
swaps never move sitters). "Won't dramatically unbalance" = a ceiling on the
weighted teamBalance+courtSpread delta (`DEFAULT_MAX_BALANCE_DELTA`, tunable).

**Provenance (no schema change).** An edited run persists through the existing
`commitSchedule` path; its report stays internally consistent because the whole
run is re-scored. The stored `seed`/`config` still describe the _generator_, and
we accept that a saved run may have been hand-tweaked — acceptable for an audit
blob. A "manually adjusted" flag on `schedule_runs` is **deferred** unless owners
ask for it; revisit if audit trails need to distinguish edited runs.

**Contract (coordinator-frozen, per §1 freeze rule):** new pure module
`domain/swaps.ts` — `suggestOpponentSwaps({ run, players, genderMode, feasibility,
roundIndex, pair, maxBalanceDelta?, limit? }): SwapSuggestion[]`, plus
`scheduleFromRun` / `baselineCoSitOverlapFor` helpers and `DEFAULT_MAX_BALANCE_DELTA`;
`refine.hardViolations` exported. UI: `ScheduleRounds` gains an optional
`onFixRematch?` prop (absent ⇒ today's read-only rendering, so CompareView and
historical rows are unaffected); a small presentational `RematchFixPanel` lists
suggestions; `SchedulePreview` threads the prop; `MatchmakingContainer` owns the
`fixing` session state and computes suggestions via the existing `runDeferred`
pattern. No engine/generator or golden change — the generator is untouched; this
is a post-generation editing layer.

## D-027 — Rating review is a single "how far?" decision with a recommendation (2026-07-24)

**Owner finding (M3.6 walkthrough).** The flagged-adjustment card
(`RatingReview.tsx`) asked organizers to make a rating call they had no way to
reason about: an unexplained header (`1.70 → 1.21 · −0.19 held for review`, where
the arrow points at a level the player _isn't_ at — the cap already applied −0.30,
so she sits at 1.40), unexplained per-round numbers, an Edit box whose raw value
is added on top of the hidden cap (so typing `0` does nothing), two look-alike
coral primary buttons, and cramped inline Edit/Discard. Owner reviewed a
three-option sketch and chose **Option B (decision-first card)**.

**Decision.** Reframe the card around the one human question — _"we've already
moved them the nightly max; how far past that do you want to go?"_ — with three
modes on a single axis and exactly one primary action:

- **Keep cautious** → the existing `discard` action (retains the auto-applied cap;
  it never removed the auto-move — the owner's worry that Discard wiped everything
  was unfounded, but the standalone "Discard drop" button is gone regardless).
- **Custom** → `edit` with `delta = target − cautiousLevel`, a stepper bounded to
  `[full … cautious]` (step 0.05). The UI always works in _resulting level_; the
  frozen `admin_review_rating_event` still receives a delta underneath. Bounds are
  intentional for now (revisit if a beyond-proposal override is ever needed).
- **Apply full** → `approve`.

**Recommendation with evidence (owner: yes, show it).** A pure helper
`ui/ratingRecommendation.ts` reads the per-match breakdown and returns a tone +
headline + evidence chips. Heuristic: `strong` (⇒ pre-select Apply full) when
**every** match agrees in direction and the average |actual−expected| points
surprise ≥ 0.22; `mixed` (⇒ pre-select Keep cautious) when ≤ half agree or the
average surprise < 0.08; else `moderate` (⇒ Apply full, with an "off night" hedge).
The recommended mode is the card's default selection; the organizer still confirms.
Thresholds are blessed starting values, expected to move once live flag volume is
seen (open question deferred: is flag frequency itself the real lever?).

**Level line.** Always drawn low-to-high left-to-right regardless of drop vs raise
— the `before`/`results say`/`now` labels carry direction — so it reads
consistently both ways; **coral for a drop, teal for a raise** (lob tokens).
Endpoint labels anchor to opposite edges with `now` below to fix the overlap the
owner flagged. Per-match rows relabelled ("Predicted N% of points · won N%") with
a one-line legend.

**No contract/schema/engine change.** `RatingReviewProps` and the three RPC
actions are untouched; this is presentation + a pure UI helper. Vocabulary stays
"level" (owner-confirmed). Static gates green (typecheck, lint, `ratingRecommendation`
5/5, matchmaking 237 pass / 2 skip); live walkthrough pending like M3.6–M3.8.

## D-028 — Ship V2 by removing the flag and the adjustment UI, not the V1 code (2026-07-25)

**Owner decision (pre-production cleanup).** V2 goes live immediately. Rather
than executing M4.3 wholesale, this session splits it: **all user-facing V1
concepts are removed now; V1 code, RPC fields and DB columns stay in place** as
an untouched fallback. Nothing in the UI can reach them.

**Decisions taken:**

- **No rollout flag.** `settings.matchmaking_v2_enabled` is gone from the client
  (schema, query, save payload, admin card); `Schedule.jsx` computes
  `useV2Matcher = isLobster && isAdmin`. The column stays in the DB, unread.
  Falling back to V1 is now a code change, deliberately — an admin can no longer
  half-disable the matcher between events.
- **`adjustment` / `adjusted_level` leave the UI entirely** (D-002/D-018 endgame):
  the "Personal Adjustment" input is deleted from the self-profile, the admin
  player form and public signup; the four write RPCs simply stop receiving the
  key (all four `coalesce` it, so `adjusted_level` lands on `playtomic_level` —
  verified, no migration needed). The ~13 display sites now read
  **`playtomicLevel`** rather than `adjusted_level`, which avoids showing a stale
  baked-in adjustment on rows never re-saved since D-018. Both columns are
  dropped from the `fetchPlayers` select, the Zod row schema and
  `normalisePlayers`, so the client no longer reads them at all.
- **The Glicko-2 "Lobster Score" UI is retired too** — it is a V1 mechanism that
  stops updating for V2 events and would silently freeze. Removed: the Settings
  "Recompute ratings" card, the per-team `Lobster N.NN` averages on the schedule,
  and the `useLobsterScore` matcher toggle (plus its now-unused
  `usePersistentBoolean` hook). `learned_rating`/`learned_rd`/
  `learned_matches_count` are likewise dropped from the read plumbing.
  `lib/glicko2.js` + `lib/ratingsRecompute.js` and their write path (legacy
  finish, alias save) are **left running** — writes to columns nobody reads, kept
  so a V1 fallback would still maintain its own ratings.
- **The admin drawer gains the V2 replacement:** learned level from
  `mm_rating`/`mm_sigma` via `useMmRatings` (`admin_get_mm_ratings`, admin-gated
  and `enabled`-guarded so non-admins never call it), shown as
  `3.90 (+0.40 vs Playtomic) ±0.45`. Two regression tests cover the admin and
  non-admin paths.
- **Lobster-only, now** (executes D-020's UI half): the format select is removed
  from `EventFormModal` and every `|| 'americano'` fallback becomes
  `lobster_matching`. The V1 generators and the `!isLobster` branch survive for
  pre-existing non-Lobster events; no reachable path creates one. `tournaments.format`
  keeps its stale `default 'americano'` — the client always sends the format
  explicitly, so no migration was taken.

**Deferred to M4.3 proper:** deleting `lobsterMatcher.js` / `glicko2.js` /
`ratingsRecompute.js` / `pairingEngine.js` / the unused generators, dropping the
four legacy columns + `players_public` view members, and the `tournaments.format`
CHECK constraint.

---

## D-029 — Split "scores done" from "results revealed" (2026-07-25)

**Decision.** `completed` keeps its current meaning exactly — scores locked,
ratings computed, admin can review. A new **independent** nullable timestamp,
`tournaments.results_shared_at`, gates only whether **non-admin players** see
the final ranking/podium/winner. Mirrors the existing `lobster_oscars_sessions`
`closed_at`/`shared_at` split (`oscarsPhase.ts::derivePhase` — `ended`: admin
sees rankings, players wait; `shared`: players see them too), reusing a pattern
already proven in this codebase rather than inventing a new one.

```
resultsPhase(t, isAdmin):
  if t.status !== 'completed'        → 'not_completed'
  if isAdmin                         → 'revealed'   (admins always see everything)
  if !t.results_shared_at            → 'pending_reveal'
  else                                → 'revealed'
```

Real-world motivation (owner): admins want a beat between "scores are in" and
"the room finds out who won" — reviewing ratings, running the raffle/Lobster
Oscars, then revealing standings as a moment, not a silent background update.

**Owner-confirmed forks (both asked directly, 2026-07-25):**

1. **What players see while withheld → "Teaser, no ranking."** A player's own
   match scores were already visible live as they were entered — that's not a
   spoiler, they were there. The spoiler is the **final ranking / podium /
   winner**. So: the tournament still shows up everywhere as completed (home
   banners, History, "Past Events"), with a neutral "Results pending — check
   back soon" teaser wherever a ranking/winner would render, and per-round match
   scores stay visible unchanged. This is deliberately the middle option between
   "hide the whole event" (loses the "something happened, come find out" pull)
   and "just gate the ranking tab" (leaves winner names in home banners, which
   was the original leak the owner was reacting to).
2. **Where the reveal action lives → Schedule.jsx, post-Finish.** Same screen
   the admin already lands on after Finish, alongside the M3.5b rating-review
   card built this session. Not gated on reviewing every flagged rating —
   revealing and reviewing are independent actions; an admin can do either
   first. Button: "Reveal results to players", shown when
   `status === 'completed' && !results_shared_at && isAdmin`.

**Surfaces audited, with the teaser rule applied:**

- **`Scores.jsx` / `ScoresRankingTab.jsx`** — ranking tab renders the teaser
  instead of the podium/standings table for non-admins in `pending_reveal`.
  `ScoresMatchesTab.jsx` (per-round scores) is **untouched** — not a spoiler
  per the rule above. The "Lobster Games" tab (Oscars results) already has its
  own independent `shared_at` gate; unaffected.
- **`RecentlyCompletedBanners.jsx`** (home) — currently computes and prints
  `🥇 Winner: <name>`. In `pending_reveal`, drops the winner line and swaps the
  button copy from "See Full Results" to something that doesn't promise a
  ranking is there yet; the banner itself (and its 48h "recently completed"
  window) is unaffected.
- **`RecentResultsList.jsx`** — same winner-line change **in principle**, but
  this component is currently **dead code**: grep found no import of it
  anywhere in `src`. Noted for whoever implements D-030; not being wired up as
  part of this work unless asked — that would be new scope, not a gate.
- **`History.jsx` (~line 331, DB-tournament "Full Standings" tab)** — same
  teaser as `ScoresRankingTab` for `pending_reveal` rows; its "Matches" tab
  (~line 595) and the hardcoded pre-DB `TOURNAMENTS` history are untouched
  (all pre-cutover, already public, definitionally `revealed`).
- **`Dashboard.jsx`** — no gate of its own; it only feeds `recentlyCompleted`
  (`status === 'completed'`, unchanged) into `RecentlyCompletedBanners`, so the
  fix lives entirely in that child.
- **`PlayerProfileDrawer.jsx` (~line 329, tournament chip)** — left as-is. The
  chip still navigates to Scores; Scores itself renders the teaser. No separate
  gate needed at the chip.
- **Schedule.jsx post-Finish `navigate('scores')`** — moot for the V2 path,
  which already stays on Schedule.jsx to render the rating-review card (M3.5b)
  rather than navigating away; this is also now where the Reveal button lives
  (fork 2). The legacy (non-V2) path still auto-navigates to Scores on Finish —
  unchanged, and it'll show the teaser there like any other pre-reveal view.

**Explicitly out of scope, flagged not fixed:** `PlayerProfileDrawer`'s
head-to-head / nemesis / partner stats (`buildPlayerStats`) aggregate over any
match with `completed = true`, which is set as scores are entered — **before**
Finish, let alone before a reveal. That's a pre-existing live-leak in the same
family as the one this decision fixes for `ScoresRankingTab`, but broader
(season totals, medal counts) and outside the surface list this session
audited. Revisit separately if it matters in practice.

**Backfill, so nothing already-public gets newly hidden.** The migration
backfills `results_shared_at = coalesce(completed_at, now())` for every row
where `status = 'completed'` at migration time. Prod's 4 completed tournaments
(all long since announced) stay visible with zero admin action; only
tournaments completed **after** this ships start in `pending_reveal`.

**No new RPC.** `results_shared_at` writes through the existing
`updateTournament` → `tournaments` direct-update path (`tournamentQueries.ts`,
same allowlist pattern as `completedAt`/`status` today) — a single-column write
on one row, not a multi-row transaction, so D-016's reasoning for RPC-gating
the rating surfaces doesn't apply here. Reuses the client's existing
admin-gated write posture; no new RLS policy.

**Impact:** new column folded into the unpushed
`20260713000001_matchmaking_v2.sql` (no extra push, per the original framing of
this work item) — costs nothing since that migration hasn't reached prod. New
pure helper `resultsPhase()` (naming/location: colocate with `schedule/utils.ts`
or a new `tournamentPhase.ts`, implementer's call, mirroring
`oscarsPhase.ts`'s pattern but not literally reusing its code — different
table, different phase set). D-030 reserved for any build-time fork that comes
up while implementing (mirrors how D-023 was resolved in a follow-up dated
addendum) — if none arises, this entry stands alone and D-030 goes unused.

## D-030 — V2 serves every format; `format` never gates the generator (2026-07-25)

**Decision:** `Schedule.jsx`'s routing drops the format check —
`useV2Matcher = isAdmin`, not `isLobster && isAdmin`. Matchmaking V2 is the
generator for **every** event an admin opens, whatever `tournaments.format`
says. The V1 annealed generator and `handleGenerate`'s format branches stay in
the tree per D-028, but no longer have a data path reaching them.

Alongside it, two DB-side V1 defaults that D-020 left behind are closed in §13
of the unpushed `20260713000001_matchmaking_v2.sql`:
`tournaments.format` default flips `'americano'` → `'lobster_matching'`, and a
backfill rewrites any non-Lobster row. `supabase/seed.sql` stops seeding its two
test tournaments as `'americano'`.

**Why:** D-020 removed the format _picker_ but nothing changed the _defaults_
behind it. `init.sql:69` still declared `format text default 'americano'`, and
`seed.sql` hardcoded `'americano'` for both local test events — so a `db:reset`
produced two events that the V2 matcher refused to serve. The owner hit exactly
this: opening a freshly-seeded event showed an "Americano" chip and the legacy
generator, on a branch where V2 is supposed to be the only path.

The gate was the real defect, not just the data. Three properties made it a trap:
the fallback `tournament.format || 'lobster_matching'` (`Schedule.jsx:138`)
only catches null/empty, so a _present but stale_ `'americano'` sails through;
any insert omitting `format` silently minted a V1 event; and with the picker
gone, `Tournament.jsx`/`Registration.jsx` pass the existing format straight back
on edit, so an affected event could never be converted from the UI — it was
stuck on V1 permanently. Fixing only the data would leave a correctness
invariant resting on "no row ever holds a non-Lobster format", which is exactly
the assumption that just failed.

**Why this doesn't contradict D-028.** D-028 chose to keep V1 as a _code-only_
fallback for pre-cutover events. That is preserved: the code is still there and
still compiles. What D-028 did not intend — and what the format gate actually
produced — was a _live routing decision_ driven by a column whose default
pointed at V1. Keeping the code is compatible with denying it a data path.

**Safety of re-routing.** `format` drives only three things, all checked:
`handleGenerate`'s generator branch, the prose chip (`formatLabel`), and the
legacy `ScheduleGeneratorControls`. Nothing in scoring, ranking, or the saved
schedule display reads it, so regenerating is the only behaviour that changes —
and old completed events display their persisted `matches` rows exactly as
before. The backfill is deliberately unconditional on `status` for the same
reason. In production it is a no-op regardless: all 6 rows are already
`lobster_matching` (M3.6 Finding 2).

**Impact:** `Schedule.jsx:146`; §13 of the unpushed migration; `seed.sql`.
`Schedule.test.tsx`'s "still falls back to the legacy generator for a
pre-cutover non-Lobster event" is **inverted** into the regression pin — an
`it.each` over `americano`/`mexicano`/`roundrobin`/`knockout`/`''` asserting all
five now reach V2. The "no Lobster Score toggle" test was retargeted off the
legacy path (unreachable for admins now, so the assertion had gone vacuous).
Verified on local: `db:reset` replays clean, both seeded events come back
`lobster_matching`, the column default is `'lobster_matching'::text`, and a
probe insert omitting `format` really does land on `lobster_matching`
(row deleted after). Gates: typecheck clean, lint 0 errors (136 pre-existing
warnings, unchanged), **707 pass / 2 skip**, build clean, goldens byte-identical.

## D-031 — Seed ratings land as one UPDATE + a `kind='seed'` provenance row, not a per-tournament RPC replay (2026-07-25)

**Decision:** M4.1's back-fill ships as a generated migration
(`20260725000001_mm_seed_ratings.sql`) that does a single `UPDATE` of
`mm_rating`/`mm_sigma`/`mm_rating_updated_at` per player, plus **one
`rating_events` row per player with `kind = 'seed'`** carrying the whole replay:
`tournament_id = null`, `prior_mu = playtomic_level`, `prior_sigma = 0.7`
(`SIGMA_PRIOR`), `proposed_delta` = the sum of the per-event uncapped deltas,
`applied_delta` = the net shift that actually moved `mm_rating`, `flagged =
false`, and a **per-event** summary in `breakdown`. It does **not** call
`admin_apply_tournament_ratings` once per historical tournament. Owner confirmed
2026-07-25 after reviewing the dry run.

**Why not the RPC path.** It cannot represent the data. Two of the six replayed
events (`dec2025`, `mar2026` — 55 of the 171 rows it would write) are
History.jsx events with **no `tournaments` row**, and
`rating_events.tournament_id` is an FK to `tournaments` that the RPC requires
non-null. Routing only the four production tournaments through it would leave
the first one's `prior_mu` silently unequal to `playtomic_level` with nothing in
the audit trail explaining the gap — a trail that lies by omission is worse than
one that is honestly coarse. Two secondary costs: the RPC's double-apply guard
would permanently block re-applying those four tournaments (a re-seed would need
row deletion first), and each call stamps `mm_rating_updated_at = now()`, so all
six "events" would carry the same timestamp anyway.

**The review-queue worry turned out to be unfounded, and is not why.** The dry
run shows only **5** flagged player-events across all six (5 × `over_cap`, 0
`drift`, 0 `oscillation`) — a 5-item queue, not a backlog. The RPC path was
rejected on representability, not volume. Nothing else is lost either: no code
computes from historical `rating_events`. `Schedule.jsx:252` hard-codes
`previousDeltas: []`, so the oscillation guardrail never consults past events;
the rows are read only by the flagged review queue and the just-finished event's
explainability.

**Faithfulness rules the replay follows** (`domain/rating/seed.ts`, pure): mu
advances by the guardrail-**capped** `appliedDelta`, never `proposedDelta` — a
withheld remainder stays withheld, exactly as live, and seeding does not
retroactively approve anything; `previousDeltas` accumulate each player's
earlier **proposed** deltas so the oscillation flag sees the sequence it would
have lived. This is where seeding deliberately differs from the M1.6 backtest,
which replays raw uncapped deltas because it measures predictive power only.
`inflateForInactivity` is **not** applied — the live path never calls it, so
using it here would invent a policy no later event maintains (flagged as its own
open question, not settled by this entry).

**History.jsx matches are included** (owner, 2026-07-25) — the 54 alias-linked
ones only; the 16 unaliased names / 62 unattributable matches stay out, as they
must. This does **not** reopen D-010: that exclusion was about bias in a
_parameter fit_, where an unattributable court corrupts the estimate. Seeding is
a _coverage_ question, and the 54 are fully attributed. Concretely: 74 players
seeded instead of 65 — 9 would otherwise enter their next event on the raw
playtomic prior — and for players present in both replays the largest divergence
is 0.28 levels, most under 0.15.

**Safety.** Both statements are guarded so the migration is a no-op where the
player row is absent (local `db:reset` has none of these ids) and where
`mm_rating` is already set — so a live Finish landing between generation and
push always wins over the stale seeded value. Verified on local against probe
rows carrying the real ids: 74 updated, 74 provenance rows, re-run inserts 0, a
pre-set "live" value survives untouched, and the flagged review queue stays
empty.

**Impact:** new pure module `domain/rating/seed.ts` (+ `seed.test.ts`, 15
acceptance tests) and dev harness `seed.harness.test.ts`, which generates both
the migration and the owner-facing dry run `docs/matchmaking-v2/seed-ratings.md`.
Fixture construction shared with the M1.6 harness is extracted to
`src/features/matchmaking/historyFixture.ts` (CLAUDE.md de-dup rule); the
extraction is provably behaviour-identical — the calibration harness regenerates
`calibration.md` byte-for-byte against the original code on the same fixture.
`kind` gains a fourth value, `'seed'`, joining `tournament | self_reset |
admin_edit`; `breakdown` on a `'seed'` row is a per-event summary, not the
per-match `breakdownRowSchema` shape a `'tournament'` row carries — nothing
renders it today (only flagged rows reach `RatingReview`), but a future reader
must not assume one shape. The migration is **generated, not hand-written**:
regenerate by re-running the harness rather than editing it.

## D-032 — Seed from production matches only; History.jsx is out (2026-07-25)

**Decision:** M4.1 seeds from the **174 production matches across 4 events**
only. The 54 alias-linked History.jsx matches that D-031 had included are
excluded, reversing that part of D-031 the same day, before anything was pushed.
Owner call after reading both replays side by side in `seed-ratings.md`: the
production-only numbers are the ones that match how these players actually play.

**Why this overrides the argument D-031 made.** D-031 reasoned from coverage —
9 more players seeded, and a maximum divergence of 0.28 levels for anyone in
both replays, so including History looked like upside with a small tail. That
reasoning was sound and still lost, because it weighed the wrong thing. The
owner has watched these people play; a replay's internal consistency is not
evidence against someone who knows the players. The two History events are also
the oldest data in the set (dec2025, mar2026) and reach the seed through an
alias table, i.e. through an identity mapping that was never verified for this
purpose. Where a divergence showed up it was almost always on players whose
production record is thin, which is exactly where a stale event drags hardest.

**What it costs, accepted:** 9 players get **no seed at all** and enter their
next event on the raw `playtomic_level` prior — `12cdb8df`, `1cb37c71`,
`38dc6f48`, `4336f8a4`, `5c666c28`, `5d8a1471`, `98f573a7`, `ab780f88`,
`c81f46d1`. Three of them (`5c666c28`, `ab780f88`, `c81f46d1`) are registered
for LOBS #9. (Players are keyed by id prefix, not name: this repo is public and
D-017 keeps a learned level admin-only. Re-run the seed harness with
`MM_SEED_NAMES=1` for a local named copy.) This is not a regression — it is the
status quo for them, and they pick up a learned level after their first
production event.

**Consequence for D-031 that must not be lost.** D-031's _primary_ argument for
a direct UPDATE over `admin_apply_tournament_ratings` was representability: two
of its six events were History.jsx events with no `tournaments` row, so the RPC
literally could not record them. With History excluded that argument is gone —
all 4 remaining events have `tournaments` rows and the RPC path is now
_possible_. The direct UPDATE stands on the surviving secondary reasons: the
RPC's double-apply guard would permanently block re-applying these 4 tournaments
(a re-seed would need row deletion first), every event would carry the same
`mm_rating_updated_at` regardless, and a generated migration fits the manual
owner-triggered push story better than 4 sequential RPC calls. **This is now a
preference, not an impossibility** — revisit if per-match historical breakdowns
are ever wanted in the admin UI. The migration header says so in place.

**Also settled:** player `12cdb8df`'s `playtomic_level` was `0` (never set); the
owner supplied her real Playtomic level, **2.23**, and it was written to
production directly (`adjusted_level` mirrored to match, no `mm_rating` existed
so D-018's reset semantics were moot). She has no production match history, so
under this decision she takes no seed — which makes the level fix the thing that
actually matters for her: it is the prior she now enters events on. Six
`playtomic_level = 0` players remain in the roster; none has match history and
none is registered for an upcoming event.

**Impact:** `seed.harness.test.ts` ships `prodOnly` as `chosen` and keeps
`withHistory` computed so the report can show the rejected alternative;
`seed-ratings.md` regenerated (65 players, 4 events, max shift 0.483, sigma
0.263–0.462, 4 flagged player-events, 88% direction agreement with V1);
`20260725000001_mm_seed_ratings.sql` regenerated at 65 rows and re-verified on
local against probe rows carrying the real ids. `domain/rating/seed.ts` is
unchanged — the source choice is a harness input, never engine behaviour.

## D-033 — The oscillation guardrail is unreachable in production (2026-07-25)

**Not a decision — a defect, recorded here because it was found while reasoning
about D-031 and must not be lost again.**

`applyGuardrails` flags `oscillation` when a player's last `OSCILLATION_RUN`
proposed deltas all exceed 0.2 with alternating sign (DESIGN §4.3: "the model
can't settle this player"). It is implemented, unit-tested, and **cannot fire
live**: `Schedule.jsx:252` passes `previousDeltas: []` on every Finish, so the
sequence the guardrail inspects is always length 1 and the
`previousDeltas.length >= tailSize` precondition is never met.

The data it needs exists and is already persisted — `rating_events.proposed_delta`
for `kind = 'tournament'` rows, ordered by `created_at`. Nothing reads it. There
is no RPC that returns a player's prior deltas, which is presumably why the
literal `[]` was written in the first place; before M4.1 the table was empty in
production anyway, so the gap cost nothing and stayed invisible.

**Why it is not fixed in this session:** M4.1's seed had to land before LOBS #9
(2026-07-26), and this needs a new admin-gated read plus a change to the Finish
path — a separate, testable piece of work, not a rider on a data migration.

**Note:** the M4.1 replay itself does implement the chain correctly — it
accumulates each player's proposed deltas across events and feeds them forward
(`seed.ts`), which is why the dry run can state 0 oscillation flags as a real
result rather than a vacuous one. So the seeded values are faithful to §4.3 even
though the live path is not yet.

**Follow-up shape:** extend `admin_get_mm_ratings()` (or add a sibling) to return
the last `OSCILLATION_RUN - 1` proposed deltas per player, and have
`applyV2Ratings` pass them through the `previousDeltas` field that
`RatingApplyPlayer` already carries. The client contract needs no change — the
field is there and typed, just never populated. Tracked in PLAN §1.
