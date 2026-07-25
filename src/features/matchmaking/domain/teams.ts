import { scoreSplit } from './cost'
import type { GenderMode, MatchAssignment, PlayerInput, ResolvedConfig, Team } from './types'

// Stage 3 (DESIGN.md §3.1): pick the cheapest legal split of a court of 4.

type CandidateSplit = {
  team1: [PlayerInput, PlayerInput]
  team2: [PlayerInput, PlayerInput]
}

/**
 * Contract (M2.5):
 * - candidate splits are enumerated over the court sorted by mu desc (ties by
 *   playerId asc) as [01|23], [02|13], [03|12]; each candidate is scored with
 *   cost.scoreSplit; ties pick the earliest candidate
 * - allowDoubleLefty false: splits containing a two-lefty team are illegal;
 *   when no legal split exists (3+ lefties on the court — the quota should
 *   have allowed it) falls back to the cheapest overall
 * - output is canonical: each team sorted by playerId, team1 lexicographically
 *   before team2
 */
export function splitCourt({
  players,
  config,
  genderMode,
  allowDoubleLefty,
}: {
  players: [PlayerInput, PlayerInput, PlayerInput, PlayerInput]
  config: ResolvedConfig
  genderMode: GenderMode
  allowDoubleLefty: boolean
}): MatchAssignment {
  const s = [...players].sort((a, b) => b.mu - a.mu || (a.playerId < b.playerId ? -1 : 1))
  const candidates: CandidateSplit[] = [
    { team1: [s[0], s[1]], team2: [s[2], s[3]] },
    { team1: [s[0], s[2]], team2: [s[1], s[3]] },
    { team1: [s[0], s[3]], team2: [s[1], s[2]] },
  ]

  const hasDoubleLefty = ({ team1, team2 }: CandidateSplit) =>
    [team1, team2].some((t) => t[0].isLeftHanded && t[1].isLeftHanded)
  const legal = allowDoubleLefty ? candidates : candidates.filter((c) => !hasDoubleLefty(c))
  const pool = legal.length > 0 ? legal : candidates

  let best = pool[0]
  let bestCost = scoreSplit({ ...best, config, genderMode })
  for (const candidate of pool.slice(1)) {
    const cost = scoreSplit({ ...candidate, config, genderMode })
    if (cost < bestCost) {
      best = candidate
      bestCost = cost
    }
  }

  const ids = (t: [PlayerInput, PlayerInput]): Team => [t[0].playerId, t[1].playerId].sort() as Team
  const [a, b] = [ids(best.team1), ids(best.team2)]
  return a.join('|') < b.join('|') ? { team1: a, team2: b } : { team1: b, team2: a }
}
