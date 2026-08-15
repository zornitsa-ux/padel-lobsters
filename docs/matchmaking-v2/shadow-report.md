# Matchmaking V2 — Shadow Comparison (M2.11)

Generated 2026-07-13 by `src/features/matchmaking/domain/shadow.harness.test.ts` over
anonymized real rosters (level/gender/handedness only). **Not reproducible:** the
harness and the legacy matcher it compared against were deleted with the rest of
the V1 generator code (D-001) — this report is the surviving artifact.

**What this compares:** the V2 matcher (three presets, deterministic) against the
legacy annealed Lobster matcher (`src/lib/lobsterMatcher.js`, stochastic — swept
over 5 seeds at the production 5000-iteration budget). Both
engines receive identical player strengths (mu = playtomic level, so this isolates
the matcher from the rating layer). Every schedule is scored under one fixed
`balanced` cost model for comparability.

Lower is better for cost / gaps / spreads / repeats / violations; higher is better
for the quality percentages.

## Verdict

**V2 is a decisive win on the #1 pain point (lopsided matches), at a tunable cost to opponent variety.**

- **Balance / lopsidedness — large win.** V2 cuts the average team-sum gap from ~0.7–0.8 levels (legacy) to ~0.1, and average court spread from ~1.4 to ~0.9. Balance quality jumps from 16–34% (legacy) to 87–92% (V2). Legacy also swings seed-to-seed (cost 83→90 on Event A); V2 is deterministic.
- **Hard rules & partner repeats — parity (all zero).** Both engines emit zero repeat partnerships, zero double-lefty teams, zero violations on these rosters.
- **Opponent variety — V2 competitive/balanced regress; social matches legacy.** Legacy keeps repeat-opponent pairs low (1–5). V2 competitive/balanced trade variety for tight bands (14–25 repeat-opponent pairs); V2 social recovers it (1–8) while still beating legacy on balance — the balance↔variety tension the presets are meant to expose.
- **Gender preference — parity** (~94–100% for both engines).

**D-015 (approved & applied 2026-07-13): the `balanced` preset socialDial J was raised 0.35 → 0.5.** The re-tuning frontier below motivated it — a near-Pareto improvement on both rosters. See D-015 for full rationale.

**Gate (PLAN §4): owner reviewed this report; Phase 3 may proceed.**

## Event A — 32 players, 8 courts, mixed (largest recent field)

22M / 10F, 4 left-handed, 6 rounds, mixed mode, no sit-outs.

| Schedule               | Cost ↓ | Team-gap avg/max ↓ | Court-spread avg/max ↓ | Opp-repeat pairs ↓ | Balance % | Variety % |
| ---------------------- | ------ | ------------------ | ---------------------- | ------------------ | --------- | --------- |
| Legacy (mean of seeds) | 90.00  | 0.69 / 2.30        | 1.40 / 2.42            | 0.4                | 25.9%     | 99.8%     |
| Legacy (best seed)     | 83.06  | 0.61 / 2.10        | 1.41 / 2.30            | 1.0                | 34.2%     | 99.5%     |
| V2 competitive         | 20.26  | 0.10 / 0.40        | 0.83 / 1.30            | 17.0               | 90.0%     | 87.0%     |
| V2 balanced            | 19.20  | 0.06 / 0.30        | 0.95 / 1.90            | 10.0               | 93.8%     | 92.7%     |
| V2 social              | 29.74  | 0.10 / 0.50        | 1.19 / 2.70            | 1.0                | 87.2%     | 99.5%     |

### `balanced` re-tuning frontier (variety levers)

| Config                               | Team-gap avg ↓ | Court-spread avg ↓ | Opp-repeat pairs ↓ | Balance ↑ | Variety ↑ |
| ------------------------------------ | -------------- | ------------------ | ------------------ | --------- | --------- |
| J=0.35, oppW=0.6 (pre-D-015 default) | 0.08           | 0.86               | 14.0               | 91.6%     | 91.7%     |
| J=0.5, oppW=0.6 (D-015 default)      | 0.06           | 0.95               | 10.0               | 93.8%     | 92.7%     |
| J=0.65, oppW=0.6                     | 0.06           | 1.05               | 7.0                | 92.2%     | 96.4%     |
| J=0.5, oppW=1.0                      | 0.11           | 1.03               | 6.0                | 87.8%     | 95.8%     |
| J=0.65, oppW=1.0                     | 0.15           | 1.09               | 5.0                | 84.4%     | 97.4%     |

## Event B — 24 players, 6 courts, mixed

18M / 6F, 1 left-handed, 6 rounds, mixed mode, no sit-outs.

| Schedule               | Cost ↓ | Team-gap avg/max ↓ | Court-spread avg/max ↓ | Opp-repeat pairs ↓ | Balance % | Variety % |
| ---------------------- | ------ | ------------------ | ---------------------- | ------------------ | --------- | --------- |
| Legacy (mean of seeds) | 75.62  | 0.79 / 2.48        | 1.41 / 2.56            | 5.2                | 15.6%     | 96.4%     |
| Legacy (best seed)     | 68.14  | 0.72 / 2.50        | 1.37 / 2.40            | 3.0                | 23.3%     | 97.9%     |
| V2 competitive         | 18.94  | 0.09 / 0.40        | 0.88 / 2.00            | 25.0               | 90.7%     | 77.1%     |
| V2 balanced            | 17.48  | 0.09 / 0.70        | 1.06 / 1.70            | 12.0               | 90.9%     | 87.5%     |
| V2 social              | 25.36  | 0.16 / 0.90        | 1.12 / 2.30            | 8.0                | 81.3%     | 94.4%     |

### `balanced` re-tuning frontier (variety levers)

| Config                               | Team-gap avg ↓ | Court-spread avg ↓ | Opp-repeat pairs ↓ | Balance ↑ | Variety ↑ |
| ------------------------------------ | -------------- | ------------------ | ------------------ | --------- | --------- |
| J=0.35, oppW=0.6 (pre-D-015 default) | 0.10           | 0.97               | 17.0               | 89.4%     | 85.4%     |
| J=0.5, oppW=0.6 (D-015 default)      | 0.09           | 1.06               | 12.0               | 90.9%     | 87.5%     |
| J=0.65, oppW=0.6                     | 0.12           | 1.03               | 9.0                | 87.4%     | 89.6%     |
| J=0.5, oppW=1.0                      | 0.13           | 1.17               | 11.0               | 86.3%     | 89.6%     |
| J=0.65, oppW=1.0                     | 0.13           | 1.06               | 12.0               | 85.0%     | 91.7%     |

## Method & caveats

- **Common yardstick.** Every schedule is re-scored under one fixed `balanced` `ResolvedConfig` so Cost and quality % compare like with like.
- **Legacy is stochastic**, swept over 5 seeds at the production budget; V2 is deterministic (one run per preset).
- **Matcher isolated from ratings.** Both engines see mu = playtomic level (sigma = 0.7) — nothing here depends on `mm_*` learned ratings.
