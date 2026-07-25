// Dev harness for M2.11 (DESIGN.md §6.3, "Replay schedules"). NOT a unit test —
// it runs the V2 matcher (all three presets) and the legacy annealed Lobster
// matcher on the same real past rosters, scores both under one common cost
// model, and writes docs/matchmaking-v2/shadow-report.md.
//
// Skipped unless MM_SHADOW_FIXTURE points at an anonymized roster snapshot
// { rosters: [{ id, label, genderMode, courts, rounds, duration, players:
// [{ playtomicLevel, gender, isLeftHanded }] }] } (level/gender/handedness
// only — no names/ids from production; kept out of git). Reproduce with:
//   MM_SHADOW_FIXTURE=/path/to/mm-shadow-fixture.json \
//     npx vitest run src/features/matchmaking/domain/shadow.harness.test.ts
//
// Fair-comparison choices (see the report's Method section):
// - Both engines get identical player strengths: mu = playtomic_level,
//   sigma = SIGMA_PRIOR. Both read the same playtomic level, so this isolates
//   the *matcher*, not the rating layer (mm_* isn't seeded until Phase 4).
// - The legacy matcher is stochastic (simulated annealing); V2 is
//   deterministic. Legacy is swept over SEEDS at the production iteration
//   budget and reported as mean + best-of-sweep.
// - Every schedule (V2 presets + legacy) is scored under one fixed "balanced"
//   config so the weighted cost and quality percentages are comparable.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { generateSchedule as generateLegacy } from '../../../lib/lobsterMatcher'
import { scoreSchedule } from './cost'
import { auditFeasibility } from './feasibility'
import { generateSchedule } from './generate'
import { resolveConfig } from './presets'
import { SIGMA_PRIOR } from './rating/model'
import { buildScheduleRun } from './report'
import type {
  GenderMode,
  MatchPreset,
  PlayerInput,
  QualityDimensions,
  ResolvedConfig,
  Schedule,
  Team,
} from './types'

const FIXTURE = process.env.MM_SHADOW_FIXTURE
const run = FIXTURE ? describe : describe.skip

const SEEDS = [1, 2, 3, 4, 5]
const LEGACY_ITERATIONS = 5000 // production default (Schedule.jsx passes no override)
const PRESETS: MatchPreset[] = ['competitive', 'balanced', 'social']

interface FixturePlayer {
  playtomicLevel: number
  gender: 'male' | 'female' | 'unknown'
  isLeftHanded: boolean
}
interface FixtureRoster {
  id: string
  label: string
  genderMode: GenderMode
  courts: number
  rounds: number
  duration: number
  players: FixturePlayer[]
}
interface Fixture {
  rosters: FixtureRoster[]
}

interface LegacyMatch {
  team1Ids: string[]
  team2Ids: string[]
}
interface LegacyRound {
  matches: LegacyMatch[]
  sitting: string[]
}

// ── metrics (weight-independent unless noted) ────────────────────────────────
interface Metrics {
  balancedCost: number // weighted total under the common balanced config
  teamGapMean: number
  teamGapMax: number
  spreadMean: number
  spreadMax: number
  partnerRepeats: number
  oppRepeatPairs: number // distinct opposing pairs meeting ≥ 2 times
  oppExcessMeetings: number // Σ max(0, meetings − 1) over opposing pairs
  sameGenderTeams: number
  sameGenderExcess: number // beyond the unavoidable per-round quota
  doubleLeftyTeams: number
  violations: number
  quality: QualityDimensions // scored under the common balanced config
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

function computeMetrics({
  schedule,
  players,
  genderMode,
  balancedConfig,
  tournamentId,
}: {
  schedule: Schedule
  players: PlayerInput[]
  genderMode: GenderMode
  balancedConfig: ResolvedConfig
  tournamentId: string
}): Metrics {
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const leftyIds = new Set(players.filter((p) => p.isLeftHanded).map((p) => p.playerId))
  const teamGaps: number[] = []
  const spreads: number[] = []
  let sameGenderTeams = 0
  let doubleLeftyTeams = 0
  const oppCounts = new Map<string, number>()

  for (const round of schedule) {
    for (const m of round.matches) {
      const t1 = m.team1.map((id) => byId.get(id)!)
      const t2 = m.team2.map((id) => byId.get(id)!)
      const four = [...t1, ...t2]
      teamGaps.push(Math.abs(t1[0].mu + t1[1].mu - (t2[0].mu + t2[1].mu)))
      spreads.push(Math.max(...four.map((p) => p.mu)) - Math.min(...four.map((p) => p.mu)))
      for (const [a, b] of [t1, t2]) {
        if (a.gender !== 'unknown' && a.gender === b.gender) sameGenderTeams += 1
        if (leftyIds.has(a.playerId) && leftyIds.has(b.playerId)) doubleLeftyTeams += 1
      }
      for (const a of m.team1) {
        for (const b of m.team2) {
          const k = pairKey(a, b)
          oppCounts.set(k, (oppCounts.get(k) ?? 0) + 1)
        }
      }
    }
  }

  let oppRepeatPairs = 0
  let oppExcessMeetings = 0
  for (const c of oppCounts.values()) {
    if (c >= 2) {
      oppRepeatPairs += 1
      oppExcessMeetings += c - 1
    }
  }

  const cost = scoreSchedule({ schedule, players, config: balancedConfig, genderMode })
  const report = buildScheduleRun({
    tournamentId,
    schedule,
    players,
    config: balancedConfig,
    genderMode,
    feasibility: auditFeasibility({
      players,
      courts: Math.max(...schedule.map((r) => r.matches.length)),
      rounds: schedule.length,
      genderMode,
      config: balancedConfig,
    }),
    baselineCoSitOverlap: 0,
  })

  return {
    balancedCost: cost.total,
    teamGapMean: mean(teamGaps),
    teamGapMax: Math.max(...teamGaps),
    spreadMean: mean(spreads),
    spreadMax: Math.max(...spreads),
    partnerRepeats: cost.raw.partnerRepeat,
    oppRepeatPairs,
    oppExcessMeetings,
    sameGenderTeams,
    sameGenderExcess: cost.raw.mixedPreference,
    doubleLeftyTeams,
    violations: report.violations.length,
    quality: report.quality.overall,
  }
}

const avgMetrics = (ms: Metrics[]): Metrics => ({
  balancedCost: mean(ms.map((m) => m.balancedCost)),
  teamGapMean: mean(ms.map((m) => m.teamGapMean)),
  teamGapMax: mean(ms.map((m) => m.teamGapMax)),
  spreadMean: mean(ms.map((m) => m.spreadMean)),
  spreadMax: mean(ms.map((m) => m.spreadMax)),
  partnerRepeats: mean(ms.map((m) => m.partnerRepeats)),
  oppRepeatPairs: mean(ms.map((m) => m.oppRepeatPairs)),
  oppExcessMeetings: mean(ms.map((m) => m.oppExcessMeetings)),
  sameGenderTeams: mean(ms.map((m) => m.sameGenderTeams)),
  sameGenderExcess: mean(ms.map((m) => m.sameGenderExcess)),
  doubleLeftyTeams: mean(ms.map((m) => m.doubleLeftyTeams)),
  violations: mean(ms.map((m) => m.violations)),
  quality: {
    balance: mean(ms.map((m) => m.quality.balance)),
    partnerFairness: mean(ms.map((m) => m.quality.partnerFairness)),
    variety: mean(ms.map((m) => m.quality.variety)),
    sitoutFairness: mean(ms.map((m) => m.quality.sitoutFairness)),
    genderPreference: mean(ms.map((m) => m.quality.genderPreference)),
  },
})

function legacyToSchedule(rounds: LegacyRound[]): Schedule {
  return rounds.map((r) => ({
    matches: r.matches.map((m) => ({
      team1: [m.team1Ids[0], m.team1Ids[1]] as Team,
      team2: [m.team2Ids[0], m.team2Ids[1]] as Team,
    })),
    sitters: [...(r.sitting ?? [])],
  }))
}

run('M2.11 shadow comparison harness', () => {
  it('runs V2 vs legacy on real rosters and writes shadow-report.md', () => {
    const fx: Fixture = JSON.parse(readFileSync(FIXTURE!, 'utf8'))
    const f1 = (n: number) => n.toFixed(1)
    const f2 = (n: number) => n.toFixed(2)
    const lines: string[] = []

    lines.push('# Matchmaking V2 — Shadow Comparison (M2.11)')
    lines.push('')
    lines.push(
      'Generated by `src/features/matchmaking/domain/shadow.harness.test.ts` over anonymized',
    )
    lines.push(
      'real rosters (level/gender/handedness only). Reproduce with the command in that file.',
    )
    lines.push('Generated ' + new Date().toISOString().slice(0, 10) + '.')
    lines.push('')
    lines.push('**What this compares:** the V2 matcher (three presets, deterministic) against the')
    lines.push('legacy annealed Lobster matcher (`src/lib/lobsterMatcher.js`, stochastic — swept')
    lines.push(
      `over ${SEEDS.length} seeds at the production ${LEGACY_ITERATIONS}-iteration budget). Both`,
    )
    lines.push('engines receive identical player strengths (mu = playtomic level, so this isolates')
    lines.push('the matcher from the rating layer). Every schedule is scored under one fixed')
    lines.push('`balanced` cost model for comparability.')
    lines.push('')
    lines.push('Lower is better for cost / gaps / spreads / repeats / violations; higher is better')
    lines.push('for the quality percentages.')
    lines.push('')
    lines.push('## Verdict')
    lines.push('')
    lines.push(
      '**V2 is a decisive win on the #1 pain point (lopsided matches), at a tunable cost to ' +
        'opponent variety.**',
    )
    lines.push('')
    lines.push(
      '- **Balance / lopsidedness — large win.** V2 cuts the average team-sum gap from ~0.7–0.8 ' +
        'levels (legacy) to ~0.1, and average court spread from ~1.4 to ~0.9. On the common ' +
        'yardstick, Balance quality jumps from 16–34% (legacy) to 87–92% (V2). This is the ' +
        'structural banding stage doing its job — balance comes from construction, not from a ' +
        'lucky anneal. Legacy also swings seed-to-seed (cost 83→90 on Event A); V2 is deterministic.',
    )
    lines.push(
      '- **Hard rules & partner repeats — parity (all zero).** Both engines emit zero repeat ' +
        'partnerships, zero double-lefty teams, and zero violations on these rosters.',
    )
    lines.push(
      '- **Opponent variety — V2 competitive/balanced regress; social matches legacy.** Legacy ' +
        'keeps repeat-opponent pairs low (1–5). V2 competitive/balanced trade variety for tight ' +
        'bands (14–25 repeat-opponent pairs); V2 social recovers it (1–8) while still beating ' +
        'legacy on balance. This is the balance↔variety tension the presets are meant to expose.',
    )
    lines.push('- **Gender preference — parity** (~94–100% for both engines).')
    lines.push('')
    lines.push(
      '**D-015 (approved & applied 2026-07-13): the `balanced` preset socialDial J was raised ' +
        '0.35 → 0.5.** The re-tuning frontier below motivated it — a near-Pareto improvement on ' +
        'both rosters (Event A: repeat-opponent pairs 14→10, Balance 91.6→93.8%, Variety ' +
        '91.7→92.7%; Event B: 17→12, Balance 89.4→90.9%, Variety 85.4→87.5%). At these field ' +
        'sizes the extra banding jitter breaks up repeat-opponent clustering *before* the ' +
        'court-spread cap binds, so balance and variety both improve; raising the opponent-repeat ' +
        'weight instead costs balance for less variety gain. The `V2 balanced` rows below already ' +
        'reflect J=0.5; the frontier still shows the J=0.35 baseline it was chosen against.',
    )
    lines.push('')
    lines.push('**Gate (PLAN §4): owner reviewed this report; Phase 3 may proceed.**')
    lines.push('')

    for (const roster of fx.rosters) {
      const players: PlayerInput[] = roster.players.map((p, i) => ({
        playerId: `${roster.id}-p${String(i + 1).padStart(2, '0')}`,
        name: `${roster.id}-p${String(i + 1).padStart(2, '0')}`,
        mu: p.playtomicLevel,
        sigma: SIGMA_PRIOR,
        isLeftHanded: p.isLeftHanded,
        gender: p.gender,
      }))
      const balancedConfig = resolveConfig({
        config: { preset: 'balanced' },
        tournamentId: roster.id,
      })

      const legacyPlayers = roster.players.map((p, i) => ({
        id: `${roster.id}-p${String(i + 1).padStart(2, '0')}`,
        playtomicLevel: p.playtomicLevel,
        gender: p.gender,
        isLeftHanded: p.isLeftHanded,
      }))

      const legacyMetrics = SEEDS.map((seed) => {
        const rounds = generateLegacy(
          legacyPlayers,
          roster.courts,
          roster.rounds,
          roster.genderMode,
          { seed, iterations: LEGACY_ITERATIONS },
        ) as LegacyRound[]
        return computeMetrics({
          schedule: legacyToSchedule(rounds),
          players,
          genderMode: roster.genderMode,
          balancedConfig,
          tournamentId: roster.id,
        })
      })
      const legacyMean = avgMetrics(legacyMetrics)
      const legacyBest = legacyMetrics.reduce((a, b) => (b.balancedCost < a.balancedCost ? b : a))

      const v2: Record<MatchPreset, Metrics> = {} as Record<MatchPreset, Metrics>
      const v2NativeQuality: Record<MatchPreset, QualityDimensions> = {} as Record<
        MatchPreset,
        QualityDimensions
      >
      for (const preset of PRESETS) {
        const runReport = generateSchedule({
          tournamentId: roster.id,
          players,
          courts: roster.courts,
          rounds: roster.rounds,
          genderMode: roster.genderMode,
          config: { preset },
        })
        v2NativeQuality[preset] = runReport.quality.overall
        const schedule: Schedule = runReport.rounds.map((round) => ({
          matches: round.courts.map((c) => ({ team1: c.teams[0], team2: c.teams[1] })),
          sitters: round.sitters.map((s) => s.playerId),
        }))
        v2[preset] = computeMetrics({
          schedule,
          players,
          genderMode: roster.genderMode,
          balancedConfig,
          tournamentId: roster.id,
        })
      }

      const rows: { label: string; m: Metrics }[] = [
        { label: 'Legacy (mean of seeds)', m: legacyMean },
        { label: 'Legacy (best seed)', m: legacyBest },
        { label: 'V2 competitive', m: v2.competitive },
        { label: 'V2 balanced', m: v2.balanced },
        { label: 'V2 social', m: v2.social },
      ]

      const males = roster.players.filter((p) => p.gender === 'male').length
      const females = roster.players.filter((p) => p.gender === 'female').length
      const lefties = roster.players.filter((p) => p.isLeftHanded).length

      lines.push(`## ${roster.label}`)
      lines.push('')
      const seatsPerRound = Math.min(roster.courts, Math.floor(roster.players.length / 4)) * 4
      lines.push(
        `Roster: **${roster.players.length}** players (${males}M / ${females}F, ${lefties} left-handed), ` +
          `**${roster.courts}** courts, **${roster.rounds}** rounds, ${roster.genderMode} mode. ` +
          `${roster.players.length === seatsPerRound ? 'No sit-outs.' : `${roster.players.length - seatsPerRound} sit-out(s) per round.`}`,
      )
      lines.push('')
      lines.push('### Headline: all schedules under the common `balanced` cost model')
      lines.push('')
      lines.push(
        '| Schedule | Cost ↓ | Team-gap avg/max ↓ | Court-spread avg/max ↓ | Partner repeats ↓ | Opp-repeat pairs ↓ | Same-gender teams (excess) ↓ | Double-lefty ↓ | Violations ↓ |',
      )
      lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
      for (const { label, m } of rows) {
        lines.push(
          `| ${label} | ${f2(m.balancedCost)} | ${f2(m.teamGapMean)} / ${f2(m.teamGapMax)} | ` +
            `${f2(m.spreadMean)} / ${f2(m.spreadMax)} | ${f1(m.partnerRepeats)} | ` +
            `${f1(m.oppRepeatPairs)} | ${f1(m.sameGenderTeams)} (${f1(m.sameGenderExcess)}) | ` +
            `${f1(m.doubleLeftyTeams)} | ${f1(m.violations)} |`,
        )
      }
      lines.push('')
      lines.push('### Quality percentages (scored under the common `balanced` model)')
      lines.push('')
      lines.push('| Schedule | Balance | Partner fairness | Variety | Gender preference |')
      lines.push('| --- | --- | --- | --- | --- |')
      for (const { label, m } of rows) {
        lines.push(
          `| ${label} | ${f1(m.quality.balance)}% | ${f1(m.quality.partnerFairness)}% | ` +
            `${f1(m.quality.variety)}% | ${f1(m.quality.genderPreference)}% |`,
        )
      }
      lines.push('')
      lines.push('### V2 preset-native quality (each under its own caps/weights)')
      lines.push('')
      lines.push('| Preset | Balance | Partner fairness | Variety | Gender preference |')
      lines.push('| --- | --- | --- | --- | --- |')
      for (const preset of PRESETS) {
        const q = v2NativeQuality[preset]
        lines.push(
          `| ${preset} | ${f1(q.balance)}% | ${f1(q.partnerFairness)}% | ${f1(q.variety)}% | ${f1(q.genderPreference)}% |`,
        )
      }
      lines.push('')

      // Balance ↔ variety frontier around the `balanced` default, to inform
      // preset re-tuning (socialDial J and opponent-repeat weight are the two
      // variety levers; higher of either buys variety at the cost of spread).
      const candidates: { name: string; socialDial: number; oppW: number }[] = [
        { name: 'J=0.35, oppW=0.6 (pre-D-015 default)', socialDial: 0.35, oppW: 0.6 },
        { name: 'J=0.5, oppW=0.6 (D-015 default)', socialDial: 0.5, oppW: 0.6 },
        { name: 'J=0.65, oppW=0.6', socialDial: 0.65, oppW: 0.6 },
        { name: 'J=0.5, oppW=1.0', socialDial: 0.5, oppW: 1.0 },
        { name: 'J=0.65, oppW=1.0', socialDial: 0.65, oppW: 1.0 },
      ]
      lines.push('### `balanced` re-tuning frontier (variety levers)')
      lines.push('')
      lines.push(
        '| Config | Team-gap avg ↓ | Court-spread avg ↓ | Opp-repeat pairs ↓ | Balance ↑ | Variety ↑ |',
      )
      lines.push('| --- | --- | --- | --- | --- | --- |')
      for (const c of candidates) {
        const rep = generateSchedule({
          tournamentId: roster.id,
          players,
          courts: roster.courts,
          rounds: roster.rounds,
          genderMode: roster.genderMode,
          config: {
            preset: 'balanced',
            socialDial: c.socialDial,
            weights: { opponentRepeat: c.oppW },
          },
        })
        const sched: Schedule = rep.rounds.map((round) => ({
          matches: round.courts.map((ct) => ({ team1: ct.teams[0], team2: ct.teams[1] })),
          sitters: round.sitters.map((s) => s.playerId),
        }))
        const m = computeMetrics({
          schedule: sched,
          players,
          genderMode: roster.genderMode,
          balancedConfig,
          tournamentId: roster.id,
        })
        lines.push(
          `| ${c.name} | ${f2(m.teamGapMean)} | ${f2(m.spreadMean)} | ${f1(m.oppRepeatPairs)} | ` +
            `${f1(m.quality.balance)}% | ${f1(m.quality.variety)}% |`,
        )
      }
      lines.push('')
    }

    lines.push('## Method & caveats')
    lines.push('')
    lines.push(
      '- **Common yardstick.** Every schedule — both engines, all presets — is re-scored under ' +
        'one fixed `balanced` `ResolvedConfig` so the Cost column and quality percentages compare ' +
        'like with like. The interpretable columns (team-gap, court-spread, partner/opponent ' +
        'repeats, same-gender teams, double-lefty) are weight-independent — they read straight off ' +
        'the schedule.',
    )
    lines.push(
      '- **Legacy is stochastic.** The annealed matcher is run over ' +
        SEEDS.length +
        ' seeds at the production ' +
        LEGACY_ITERATIONS +
        '-iteration budget; the table shows the seed mean and the single best-cost seed. V2 is ' +
        'deterministic, so one run per preset is the whole story.',
    )
    lines.push(
      '- **Matcher isolated from ratings.** Both engines see mu = playtomic level (sigma = ' +
        SIGMA_PRIOR +
        '). Both engines read the same playtomic level, so nothing here ' +
        'depends on the not-yet-seeded `mm_*` learned ratings — this is purely a scheduling ' +
        'comparison.',
    )
    lines.push(
      '- **Same-gender excess** is same-gender teams beyond the per-round unavoidable quota ' +
        '(D-011); the raw same-gender team count is shown alongside it in parentheses.',
    )
    lines.push('')

    const outPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../docs/matchmaking-v2/shadow-report.md',
    )
    writeFileSync(outPath, lines.join('\n'))
    console.log(`[shadow] wrote ${outPath}`)

    expect(fx.rosters.length).toBeGreaterThan(0)
  })
})
