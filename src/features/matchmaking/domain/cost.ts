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

const isSameGenderTeam = (a: PlayerInput, b: PlayerInput): boolean =>
  a.gender !== 'unknown' && a.gender === b.gender

const partnerGapExcess = (a: PlayerInput, b: PlayerInput, maxPartnerGap: number): number =>
  Math.max(0, Math.abs(a.mu - b.mu) - maxPartnerGap) / maxPartnerGap

// Column view of the roster, memoized per players array. scoreSchedule runs
// ~20k times per generate against an unchanging roster, so rebuilding the id
// index and re-reading object fields per call dominated the search cost.
// Numeric ids also let pair counts key on an integer instead of a built string.
const GENDER_UNKNOWN = 0
const GENDER_MALE = 1
const GENDER_FEMALE = 2

type RosterView = {
  index: Map<string, number>
  mu: Float64Array
  sigma: Float64Array
  gender: Int8Array
  size: number
}

const rosterViews = new WeakMap<PlayerInput[], RosterView>()

function rosterView(players: PlayerInput[]): RosterView {
  const cached = rosterViews.get(players)
  if (cached) return cached

  const size = players.length
  const view: RosterView = {
    index: new Map(players.map((p, i) => [p.playerId, i])),
    mu: new Float64Array(size),
    sigma: new Float64Array(size),
    gender: new Int8Array(size),
    size,
  }
  players.forEach((p, i) => {
    view.mu[i] = p.mu
    view.sigma[i] = p.sigma
    view.gender[i] =
      p.gender === 'male' ? GENDER_MALE : p.gender === 'female' ? GENDER_FEMALE : GENDER_UNKNOWN
  })
  rosterViews.set(players, view)
  return view
}

// Summation order here is load-bearing: the golden snapshots pin exact floats,
// so any optimization must accumulate in the same order (PLAN §3).
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
  const { index, mu, sigma, gender, size } = rosterView(players)
  const idx = (id: string): number => {
    const i = index.get(id)
    if (i === undefined) throw new Error(`scoreSchedule: unknown player ${id}`)
    return i
  }
  // Canonical integer key for an unordered pair — replaces building a string
  // per pair, six times per match, on every one of ~20k scoring passes.
  const pairId = (a: number, b: number): number => (a < b ? a * size + b : b * size + a)

  const raw = Object.fromEntries(DIMENSION_KEYS.map((k) => [k, 0])) as DimensionScores
  const partnerCounts = new Map<number, number>()
  const opponentCounts = new Map<number, number>()
  const { balanceTolerance, maxPartnerGap, maxCourtSpread } = config

  for (const round of schedule) {
    let sameGenderTeams = 0
    let maleCount = 0
    let femaleCount = 0
    let playingCount = 0

    for (const match of round.matches) {
      const a1 = idx(match.team1[0])
      const b1 = idx(match.team1[1])
      const a2 = idx(match.team2[0])
      const b2 = idx(match.team2[1])
      const muA1 = mu[a1]
      const muB1 = mu[b1]
      const muA2 = mu[a2]
      const muB2 = mu[b2]

      raw.teamBalance += Math.abs(muA1 + muB1 - (muA2 + muB2)) / balanceTolerance

      raw.partnerGap += Math.max(0, Math.abs(muA1 - muB1) - maxPartnerGap) / maxPartnerGap
      if (gender[a1] !== GENDER_UNKNOWN && gender[a1] === gender[b1]) sameGenderTeams += 1
      raw.partnerGap += Math.max(0, Math.abs(muA2 - muB2) - maxPartnerGap) / maxPartnerGap
      if (gender[a2] !== GENDER_UNKNOWN && gender[a2] === gender[b2]) sameGenderTeams += 1

      let maxMu = muA1
      let minMu = muA1
      if (muB1 > maxMu) maxMu = muB1
      if (muB1 < minMu) minMu = muB1
      if (muA2 > maxMu) maxMu = muA2
      if (muA2 < minMu) minMu = muA2
      if (muB2 > maxMu) maxMu = muB2
      if (muB2 < minMu) minMu = muB2

      let maxSigma = sigma[a1]
      if (sigma[b1] > maxSigma) maxSigma = sigma[b1]
      if (sigma[a2] > maxSigma) maxSigma = sigma[a2]
      if (sigma[b2] > maxSigma) maxSigma = sigma[b2]

      const cap = maxCourtSpread + maxSigma / 2
      raw.courtSpread += Math.max(0, maxMu - minMu - cap) / maxCourtSpread

      const partner1 = pairId(a1, b1)
      const meetings1 = (partnerCounts.get(partner1) ?? 0) + 1
      partnerCounts.set(partner1, meetings1)
      if (meetings1 >= 2) raw.partnerRepeat += 1
      const partner2 = pairId(a2, b2)
      const meetings2 = (partnerCounts.get(partner2) ?? 0) + 1
      partnerCounts.set(partner2, meetings2)
      if (meetings2 >= 2) raw.partnerRepeat += 1

      for (const a of [a1, b1]) {
        for (const b of [a2, b2]) {
          const key = pairId(a, b)
          const meetings = (opponentCounts.get(key) ?? 0) + 1
          opponentCounts.set(key, meetings)
          if (meetings === 2) raw.opponentRepeat += 0.5
          else if (meetings >= 3) raw.opponentRepeat += 1
        }
      }

      if (gender[a1] === GENDER_MALE) maleCount += 1
      else if (gender[a1] === GENDER_FEMALE) femaleCount += 1
      if (gender[b1] === GENDER_MALE) maleCount += 1
      else if (gender[b1] === GENDER_FEMALE) femaleCount += 1
      if (gender[a2] === GENDER_MALE) maleCount += 1
      else if (gender[a2] === GENDER_FEMALE) femaleCount += 1
      if (gender[b2] === GENDER_MALE) maleCount += 1
      else if (gender[b2] === GENDER_FEMALE) femaleCount += 1
      playingCount += 4
    }

    if (genderMode === 'mixed') {
      const quota = sameGenderQuotaForRound({
        maleCount,
        femaleCount,
        unknownCount: playingCount - maleCount - femaleCount,
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
