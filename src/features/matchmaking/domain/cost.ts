import { sameGenderQuotaForRound } from './feasibility'
import { coSitOverlap } from './sitouts'
import { DIMENSION_KEYS } from './types'
import type {
  DimensionScores,
  GenderMode,
  PlayerInput,
  ResolvedConfig,
  Schedule,
  ScheduleCost,
} from './types'

// Single scoring entry point (DESIGN.md §3.2), used by teams, refine, and
// report. Raw dimension scores are per-match 0..1 units summed over the
// schedule; weighted = raw × weight; total = Σ weighted.
//
// Raw dimension contracts (M2.6):
// - teamBalance:    |sumA − sumB| / balanceTolerance per match
// - partnerGap:     max(0, |muA − muB| − maxPartnerGap) / maxPartnerGap per team
// - courtSpread:    max(0, spread − cap′) / maxCourtSpread per match, where
//                   cap′ = maxCourtSpread + max(sigma on court) / 2 (D-013)
// - opponentRepeat: per opposing pair, meetings accumulate chronologically
//                   over rounds; the 2nd meeting scores 0.5 and each 3rd+
//                   meeting 1.0, in the round the repeat occurs
// - partnerRepeat:  1.0 per repeated partnership occurrence, in the round it
//                   occurs
// - mixedPreference: mixed mode only — per round,
//                   max(0, sameGenderTeams − sameGenderQuotaForRound); teams
//                   containing an unknown-gender player never count (D-011)
// - sitGroupOverlap: max(0, coSitOverlap(sit plan) − baselineCoSitOverlap)

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

const isSameGenderTeam = (a: PlayerInput, b: PlayerInput): boolean =>
  a.gender !== 'unknown' && a.gender === b.gender

const partnerGapExcess = (a: PlayerInput, b: PlayerInput, maxPartnerGap: number): number =>
  Math.max(0, Math.abs(a.mu - b.mu) - maxPartnerGap) / maxPartnerGap

export function scoreSchedule({
  schedule,
  players,
  config,
  genderMode,
  baselineCoSitOverlap = 0,
}: {
  schedule: Schedule
  players: PlayerInput[]
  config: ResolvedConfig
  genderMode: GenderMode
  // coSitOverlap of the stage-1 plan; defaults to 0.
  baselineCoSitOverlap?: number
}): ScheduleCost {
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const get = (id: string): PlayerInput => {
    const p = byId.get(id)
    if (!p) throw new Error(`scoreSchedule: unknown player ${id}`)
    return p
  }

  const raw = Object.fromEntries(DIMENSION_KEYS.map((k) => [k, 0])) as DimensionScores
  const partnerCounts = new Map<string, number>()
  const opponentCounts = new Map<string, number>()

  for (const round of schedule) {
    let sameGenderTeams = 0

    for (const match of round.matches) {
      const team1 = [get(match.team1[0]), get(match.team1[1])] as const
      const team2 = [get(match.team2[0]), get(match.team2[1])] as const
      const four = [...team1, ...team2]

      const sum1 = team1[0].mu + team1[1].mu
      const sum2 = team2[0].mu + team2[1].mu
      raw.teamBalance += Math.abs(sum1 - sum2) / config.balanceTolerance

      for (const [a, b] of [team1, team2]) {
        raw.partnerGap += partnerGapExcess(a, b, config.maxPartnerGap)
        if (isSameGenderTeam(a, b)) sameGenderTeams += 1
      }

      const mus = four.map((p) => p.mu)
      const spread = Math.max(...mus) - Math.min(...mus)
      const cap = config.maxCourtSpread + Math.max(...four.map((p) => p.sigma)) / 2
      raw.courtSpread += Math.max(0, spread - cap) / config.maxCourtSpread

      for (const team of [match.team1, match.team2]) {
        const key = pairKey(team[0], team[1])
        const meetings = (partnerCounts.get(key) ?? 0) + 1
        partnerCounts.set(key, meetings)
        if (meetings >= 2) raw.partnerRepeat += 1
      }
      for (const a of match.team1) {
        for (const b of match.team2) {
          const key = pairKey(a, b)
          const meetings = (opponentCounts.get(key) ?? 0) + 1
          opponentCounts.set(key, meetings)
          if (meetings === 2) raw.opponentRepeat += 0.5
          else if (meetings >= 3) raw.opponentRepeat += 1
        }
      }
    }

    if (genderMode === 'mixed') {
      const playing = round.matches.flatMap((m) => [...m.team1, ...m.team2]).map(get)
      const maleCount = playing.filter((p) => p.gender === 'male').length
      const femaleCount = playing.filter((p) => p.gender === 'female').length
      const quota = sameGenderQuotaForRound({
        maleCount,
        femaleCount,
        unknownCount: playing.length - maleCount - femaleCount,
        courtsUsed: round.matches.length,
      })
      raw.mixedPreference += Math.max(0, sameGenderTeams - quota)
    }
  }

  raw.sitGroupOverlap = Math.max(
    0,
    coSitOverlap({ plan: schedule.map((r) => r.sitters) }) - baselineCoSitOverlap,
  )

  const weighted = Object.fromEntries(
    DIMENSION_KEYS.map((k) => [k, raw[k] * config.weights[k]]),
  ) as DimensionScores
  const total = DIMENSION_KEYS.reduce((sum, k) => sum + weighted[k], 0)
  return { total, raw, weighted }
}

/**
 * Weighted split-local cost of one candidate match: teamBalance + partnerGap
 * + mixedPreference only (courtSpread is split-invariant; repeat dimensions
 * need cross-round context). Same-gender teams cost their full weight here —
 * no quota offset at split level. Used by teams.splitCourt.
 */
export function scoreSplit({
  team1,
  team2,
  config,
  genderMode,
}: {
  team1: [PlayerInput, PlayerInput]
  team2: [PlayerInput, PlayerInput]
  config: ResolvedConfig
  genderMode: GenderMode
}): number {
  const sum1 = team1[0].mu + team1[1].mu
  const sum2 = team2[0].mu + team2[1].mu
  let cost = (Math.abs(sum1 - sum2) / config.balanceTolerance) * config.weights.teamBalance
  for (const [a, b] of [team1, team2]) {
    cost += partnerGapExcess(a, b, config.maxPartnerGap) * config.weights.partnerGap
    if (genderMode === 'mixed' && isSameGenderTeam(a, b)) cost += config.weights.mixedPreference
  }
  return cost
}
