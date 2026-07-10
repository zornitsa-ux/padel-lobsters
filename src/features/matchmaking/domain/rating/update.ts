import type { MatchDelta, MatchResult, RatedPlayer, RatingParams, RatingUpdate } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { SIGMA_FLOOR } from './model'

/**
 * Expected point share of a team from its mu-sum advantage (DESIGN.md §4.1):
 * E = 1 / (1 + 10^(−advantage / levelScale)). A `levelScale` of combined
 * advantage produces a 10:1 expected point ratio.
 */
export function expectedShare({
  teamAdvantage,
  levelScale,
}: {
  teamAdvantage: number
  levelScale: number
}): number {
  return 1 / (1 + 10 ** (-teamAdvantage / levelScale))
}

/**
 * Batch tournament update (DESIGN.md §4.2). Every expectation is computed
 * against the pre-tournament `ratings` (rating-period semantics) — match
 * order within the tournament must not affect the result.
 *
 * Per counted match, per player: delta = w * K * (p - E) with
 *   p = own team's point share, E = 1 / (1 + 10^(-(Town - Topp) / levelScale)),
 *   w = min(1, totalPoints / nRef),
 *   K = learnScale * sigma_i^2 / (sum of all four sigma^2 + perfNoise^2).
 * newSigma: 1/sigma'^2 = 1/sigma^2 + sum(w * infoPerMatch), floored at SIGMA_FLOOR.
 *
 * Contract:
 * - matches with score1 + score2 === 0 are treated as unplayed (no delta,
 *   no sigma information)
 * - roster players with no counted matches produce no RatingUpdate
 * - a match player id missing from `ratings`, or the same player appearing
 *   twice in one match, throws
 * - output sorted by playerId; matchDeltas sorted by round, then matchId
 * - params defaults to DEFAULT_RATING_PARAMS
 */
export function updateRatingsForTournament({
  ratings,
  matches,
  params = DEFAULT_RATING_PARAMS,
}: {
  ratings: RatedPlayer[]
  matches: MatchResult[]
  params?: RatingParams
}): RatingUpdate[] {
  const byId = new Map(ratings.map((p) => [p.playerId, p]))
  const deltasByPlayer = new Map<string, MatchDelta[]>()
  const infoByPlayer = new Map<string, number>()

  for (const m of matches) {
    const ids = [...m.team1, ...m.team2]
    for (const id of ids) {
      if (!byId.has(id)) throw new Error(`match ${m.matchId}: player ${id} not in ratings`)
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error(`match ${m.matchId}: a player appears twice`)
    }

    const total = m.score1 + m.score2
    if (total === 0) continue

    const weight = Math.min(1, total / params.nRef)
    const gainDenom = ids.reduce((s, id) => s + byId.get(id)!.sigma ** 2, 0) + params.perfNoise ** 2
    const muSum = (team: [string, string]) => byId.get(team[0])!.mu + byId.get(team[1])!.mu

    const sides: { team: [string, string]; opponents: [string, string]; score: number }[] = [
      { team: m.team1, opponents: m.team2, score: m.score1 },
      { team: m.team2, opponents: m.team1, score: m.score2 },
    ]
    for (const { team, opponents, score } of sides) {
      const teamAdvantage = muSum(team) - muSum(opponents)
      const expected = expectedShare({ teamAdvantage, levelScale: params.levelScale })
      const actualShare = score / total
      for (const playerId of team) {
        const gain = (params.learnScale * byId.get(playerId)!.sigma ** 2) / gainDenom
        const row: MatchDelta = {
          matchId: m.matchId,
          round: m.round,
          partnerId: playerId === team[0] ? team[1] : team[0],
          opponentIds: [opponents[0], opponents[1]],
          teamAdvantage,
          expectedShare: expected,
          actualShare,
          weight,
          gain,
          delta: weight * gain * (actualShare - expected),
        }
        deltasByPlayer.set(playerId, [...(deltasByPlayer.get(playerId) ?? []), row])
        infoByPlayer.set(playerId, (infoByPlayer.get(playerId) ?? 0) + weight * params.infoPerMatch)
      }
    }
  }

  return [...deltasByPlayer.keys()].sort().map((playerId) => {
    const prior = byId.get(playerId)!
    const matchDeltas = [...deltasByPlayer.get(playerId)!].sort(
      // Codepoint order, not localeCompare, so ordering is host-locale
      // independent (determinism is a hard guarantee — see module doc).
      (a, b) => a.round - b.round || (a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0),
    )
    const newSigma = Math.max(
      SIGMA_FLOOR,
      1 / Math.sqrt(1 / prior.sigma ** 2 + infoByPlayer.get(playerId)!),
    )
    return {
      playerId,
      priorMu: prior.mu,
      priorSigma: prior.sigma,
      proposedDelta: matchDeltas.reduce((s, d) => s + d.delta, 0),
      newSigma,
      matchDeltas,
    }
  })
}
