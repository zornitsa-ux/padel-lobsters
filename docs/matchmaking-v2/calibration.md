# Matchmaking V2 — Rating Calibration (M1.6)

Fitted by `src/features/matchmaking/domain/rating/calibrate.ts` (pure), driven
by `calibrate.harness.test.ts` over real history. Reproduce with the command in
that harness file. Generated 2026-07-10. See D-010 for the decision and
rationale this backtest fed.

## Dataset

- Production matches (player_id-keyed, no aliases): **174**
- History.jsx matches resolved through existing aliases: **54** (dropped 62 — an unaliased player on court; owner chose not to link)
- Total scored matches replayed: **228**
- Distinct players with a prior: **74**
- Events: **6** (chronological replay)

## Constants

| Param        | Symbol | Default (pre-M1.6) | Full-grid fit | **Adopted** |
| ------------ | ------ | ------------------ | ------------- | ----------- |
| levelScale   | D      | 7                  | 7             | **7**       |
| perfNoise    | β      | 0.5                | 0.3           | **0.5**     |
| learnScale   | G      | 1                  | 1.5           | **1**       |
| nRef         | N_ref  | 7                  | 7             | **7**       |
| infoPerMatch | I      | 0.58               | 0.58          | **0.58**    |

**Adopted = the conservative fit: move only `levelScale` (well-identified — a genuine, if shallow, Brier basin over 228 matches), hold the learning params (β, G, N_ref, I) at their D-003/D-006 blessed defaults.** The full-grid fit also nudges β↓ and G↑, but that buys <0.001 Brier and is weakly identified by only 6 event-transitions — false precision, better tuned on live events (D-003).

## Backtest (Brier = mean squared error of point-share predictions; lower better)

| Model                        | Brier  | logLoss | n   |
| ---------------------------- | ------ | ------- | --- |
| V2 defaults                  | 0.0541 | 0.6763  | 228 |
| V2 adopted (levelScale only) | 0.0541 | 0.6763  | 228 |
| V2 full-grid fit             | 0.0538 | 0.6757  | 228 |
| Glicko-2 (legacy)            | 0.0577 | —       | 228 |

**Gate (DESIGN §6.2): V2 adopted Brier 0.0541 ≤ Glicko-2 0.0577 → PARITY MET.**

## Method & caveats

- **Chronological replay, predict-then-learn.** Each match is scored against the ratings held before its event (rating-period semantics), so every prediction is genuinely out-of-sample. Both models start every player at their self-reported `playtomic_level` prior.
- **Raw model output, no guardrails.** The backtest applies the uncapped `proposedDelta` — it measures the rating model's predictive power, not the §4.3 governance layer (cap/flags) that sits on top of it in production.
- **Alias gap (owner decision, 2026-07-10).** 62 History.jsx matches were dropped because a player on court has no `player_aliases` row and the owner chose not to link them; the ladies event (apr2026) and the standings-only jan2026 contribute nothing. Production matches carry the fit.
- **Learning params are weakly identified.** Only 6 event-transitions constrain β/G/I; their full-grid moves change Brier by <0.001. Left at blessed defaults, retuned on live events per D-003.
