import { scoreSchedule } from './cost'
import type {
  DimensionScores,
  FeasibilityResult,
  GenderMode,
  PlayerInput,
  QualityDimensions,
  ResolvedConfig,
  RoundReport,
  Schedule,
  ScheduleRun,
  Violation,
} from './types'
import { DIMENSION_KEYS } from './types'

// Stage 5 (DESIGN.md §3.4): assemble the persisted ScheduleRun.

/** Courts flag 'high-sigma-player' at or above this sigma. */
export const HIGH_SIGMA_FLAG_THRESHOLD = 0.5

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

const diffRaw = (a: DimensionScores, b: DimensionScores): DimensionScores =>
  Object.fromEntries(DIMENSION_KEYS.map((k) => [k, a[k] - b[k]])) as DimensionScores

const qualityFrom = ({
  raw,
  matches,
  sitoutFairness,
  isMixed,
}: {
  raw: DimensionScores
  matches: number
  sitoutFairness: number
  isMixed: boolean
}): QualityDimensions => {
  const n2 = 2 * matches
  const pct = (x: number) => 100 * Math.max(0, 1 - x)
  return {
    balance: pct((raw.teamBalance + raw.courtSpread) / n2),
    partnerFairness: pct(raw.partnerGap / n2),
    variety: pct((raw.opponentRepeat + raw.partnerRepeat) / n2),
    sitoutFairness,
    genderPreference: isMixed ? pct(raw.mixedPreference / n2) : 100,
  }
}

/**
 * Contract (M2.8):
 * - rounds/courts numbered 1-based; court players and sitters are full
 *   PlayerInput snapshots (sitters sorted by playerId); teams canonical;
 *   teamSums = team mu sums; courtSpread = max mu − min mu on the court
 * - flags: 'high-sigma-player' (any sigma ≥ HIGH_SIGMA_FLAG_THRESHOLD),
 *   'opponent-rematch' (the court contains an opposing pair meeting ≥ 2nd
 *   time, attributed to the round where the rematch occurs)
 * - violations: one entry per double-lefty team (rule 'lefty') and per
 *   repeated partnership occurrence (rule 'partner-repeat'); sit-rule
 *   violations carry court: null
 * - feasibility entries are copied from the audit verbatim
 * - quality (0–100; n = matches, t = 2n teams, R = rounds; raw scores from
 *   cost.scoreSchedule):
 *     balance          = 100·max(0, 1 − (raw.teamBalance + raw.courtSpread) / 2n)
 *     partnerFairness  = 100·max(0, 1 − raw.partnerGap / t)
 *     variety          = 100·max(0, 1 − (raw.opponentRepeat + raw.partnerRepeat) / 2n)
 *     sitoutFairness   = 100 when nobody sits, else 100·max(0, 1 − raw.sitGroupOverlap / R)
 *     genderPreference = 100 unless mixed mode, else 100·max(0, 1 − raw.mixedPreference / t)
 *   perRound applies the same formulas to each round's own raw scores
 *   (repeat costs attribute to the round of the repeat; sitoutFairness
 *   repeats the event-level value)
 */
export function buildScheduleRun({
  tournamentId,
  schedule,
  players,
  config,
  genderMode,
  feasibility,
  baselineCoSitOverlap = 0,
}: {
  tournamentId: string
  schedule: Schedule
  players: PlayerInput[]
  config: ResolvedConfig
  genderMode: GenderMode
  feasibility: FeasibilityResult
  baselineCoSitOverlap?: number
}): ScheduleRun {
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const get = (id: string): PlayerInput => {
    const p = byId.get(id)
    if (!p) throw new Error(`buildScheduleRun: unknown player ${id}`)
    return p
  }

  // Prefix diffs attribute chronological repeat costs to the round they occur.
  const prefixRaws = schedule.map(
    (_, i) =>
      scoreSchedule({
        schedule: schedule.slice(0, i + 1),
        players,
        config,
        genderMode,
        baselineCoSitOverlap,
      }).raw,
  )
  const overallRaw = prefixRaws[prefixRaws.length - 1]
  const roundRaws = prefixRaws.map((raw, i) => (i === 0 ? raw : diffRaw(raw, prefixRaws[i - 1])))

  const leftyIds = new Set(players.filter((p) => p.isLeftHanded).map((p) => p.playerId))
  const partnerCounts = new Map<string, number>()
  const opponentCounts = new Map<string, number>()
  const sitCounts = new Map<string, number>()
  const violations: Violation[] = []

  const rounds: RoundReport[] = schedule.map((round, r) => {
    const courts = round.matches.map((m, c) => {
      const team1 = [get(m.team1[0]), get(m.team1[1])] as const
      const team2 = [get(m.team2[0]), get(m.team2[1])] as const
      const four = [...team1, ...team2]
      const flags: string[] = []

      if (four.some((p) => p.sigma >= HIGH_SIGMA_FLAG_THRESHOLD)) flags.push('high-sigma-player')

      let rematch = false
      for (const a of m.team1) {
        for (const b of m.team2) {
          const meetings = (opponentCounts.get(pairKey(a, b)) ?? 0) + 1
          opponentCounts.set(pairKey(a, b), meetings)
          if (meetings >= 2) rematch = true
        }
      }
      if (rematch) flags.push('opponent-rematch')

      for (const team of [m.team1, m.team2]) {
        if (team.every((id) => leftyIds.has(id))) {
          violations.push({
            round: r + 1,
            court: c + 1,
            rule: 'lefty',
            reason: `${team[0]} and ${team[1]} are both left-handed`,
          })
        }
        const key = pairKey(team[0], team[1])
        const times = (partnerCounts.get(key) ?? 0) + 1
        partnerCounts.set(key, times)
        if (times >= 2) {
          violations.push({
            round: r + 1,
            court: c + 1,
            rule: 'partner-repeat',
            reason: `${team[0]} and ${team[1]} partner for the ${times}${times === 2 ? 'nd' : times === 3 ? 'rd' : 'th'} time`,
          })
        }
      }

      const mus = four.map((p) => p.mu)
      return {
        players: four,
        teams: [m.team1, m.team2] as [typeof m.team1, typeof m.team2],
        teamSums: [team1[0].mu + team1[1].mu, team2[0].mu + team2[1].mu] as [number, number],
        courtSpread: Math.max(...mus) - Math.min(...mus),
        flags,
      }
    })

    if (r > 0) {
      const prev = new Set(schedule[r - 1].sitters)
      for (const id of round.sitters) {
        if (prev.has(id)) {
          violations.push({
            round: r + 1,
            court: null,
            rule: 'sit-outs',
            reason: `${id} sits out in consecutive rounds`,
          })
        }
      }
    }
    for (const id of round.sitters) sitCounts.set(id, (sitCounts.get(id) ?? 0) + 1)

    return { courts, sitters: [...round.sitters].sort().map(get) }
  })

  const everSitting = [...sitCounts.values()]
  if (everSitting.length > 0) {
    const min = sitCounts.size < players.length ? 0 : Math.min(...everSitting)
    if (Math.max(...everSitting) - min > 1) {
      violations.push({
        round: schedule.length,
        court: null,
        rule: 'sit-outs',
        reason: 'sit-out counts differ by more than 1 across the roster',
      })
    }
  }

  const anySitters = schedule.some((r) => r.sitters.length > 0)
  const totalMatches = schedule.reduce((s, r) => s + r.matches.length, 0)
  const sitoutFairness = anySitters
    ? 100 * Math.max(0, 1 - overallRaw.sitGroupOverlap / schedule.length)
    : 100
  const isMixed = genderMode === 'mixed'

  return {
    tournamentId,
    config,
    seed: config.seed,
    feasibility: feasibility.entries,
    rounds,
    quality: {
      overall: qualityFrom({ raw: overallRaw, matches: totalMatches, sitoutFairness, isMixed }),
      perRound: roundRaws.map((raw, i) =>
        qualityFrom({ raw, matches: schedule[i].matches.length, sitoutFairness, isMixed }),
      ),
    },
    violations,
  }
}
