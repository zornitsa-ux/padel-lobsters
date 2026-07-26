import type { HistoricalMatch, HistoricalRound } from '../../lib/playerStats'

// ── Archive shapes ────────────────────────────────────────────────────────────
// `src/data/historicalTournaments.js` is untyped by design (hardcoded pre-app
// archive). These interfaces are the boundary contract History casts it to.
// The match/round shapes narrow the ones playerStats already declares so the
// archive's two consumers can't drift apart.

export interface ArchiveMatch extends HistoricalMatch {
  court?: number | string
  s1: number
  s2: number
}

export interface ArchiveRound extends HistoricalRound {
  round: number
  matches: ArchiveMatch[]
}

// A final-standings row. `r` (per-round scores) is only recorded for some
// tournaments.
export interface ArchiveStanding {
  name: string
  total: number
  r?: number[]
}

export interface ArchiveTournament {
  id: string
  name: string
  date?: string
  type?: string
  players?: ArchiveStanding[]
  rounds?: ArchiveRound[] | null
  numRounds?: number | null
  numCourts?: number | null
  note?: string
}

export interface PlayerTiebreakStats {
  matchesWon: number
  pointsFor: number
  pointsAgainst: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate match wins and point differential for tiebreaking.
 * Analyzes rounds data to count wins per player and calculate point differential.
 */
export function calculateStats(
  players: ArchiveStanding[],
  rounds: ArchiveRound[],
): Record<string, PlayerTiebreakStats> {
  const stats: Record<string, PlayerTiebreakStats> = {}
  players.forEach((p) => {
    stats[p.name] = { matchesWon: 0, pointsFor: 0, pointsAgainst: 0 }
  })

  rounds.forEach((round) => {
    round.matches?.forEach((match) => {
      // Determine which team won
      const team1Won = match.s1 > match.s2
      const team2Won = match.s2 > match.s1

      // Track points and wins
      match.t1?.forEach((name) => {
        if (stats[name]) {
          stats[name].pointsFor += match.s1
          stats[name].pointsAgainst += match.s2
          if (team1Won) stats[name].matchesWon += 1
        }
      })
      match.t2?.forEach((name) => {
        if (stats[name]) {
          stats[name].pointsFor += match.s2
          stats[name].pointsAgainst += match.s1
          if (team2Won) stats[name].matchesWon += 1
        }
      })
    })
  })

  return stats
}

/**
 * Smart ranking: Points → Matches Won → Differential → Alphabetical
 */
export function smartSort(players: ArchiveStanding[], rounds: ArchiveRound[]): ArchiveStanding[] {
  const stats = calculateStats(players, rounds)
  return [...players].sort((a, b) => {
    // 1. By total points (descending)
    if (a.total !== b.total) return b.total - a.total

    // 2. By matches won (descending)
    const aWins = stats[a.name]?.matchesWon || 0
    const bWins = stats[b.name]?.matchesWon || 0
    if (aWins !== bWins) return bWins - aWins

    // 3. By points differential (descending)
    const aDiff = (stats[a.name]?.pointsFor || 0) - (stats[a.name]?.pointsAgainst || 0)
    const bDiff = (stats[b.name]?.pointsFor || 0) - (stats[b.name]?.pointsAgainst || 0)
    if (aDiff !== bDiff) return bDiff - aDiff

    // 4. Alphabetically (ascending)
    return a.name.localeCompare(b.name)
  })
}

// Build a {fullName: displayName} map.
// • If a first name is unique in the input, display = first name only.
// • If multiple players share a first name, append the rest of the name —
//   the original last token if it's already short (≤2 chars, e.g. "Alex M"),
//   otherwise just the last name's initial (e.g. "Daniel Net Hitter" → "Daniel N").
export function buildDisplayNames(names: readonly string[]): Record<string, string> {
  const groups: Record<string, string[]> = {}
  ;(names || []).forEach((n) => {
    if (!n) return
    const f = n.trim().split(/\s+/)[0] || n
    if (!groups[f]) groups[f] = []
    groups[f].push(n)
  })
  const out: Record<string, string> = {}
  Object.entries(groups).forEach(([first, group]) => {
    const unique = [...new Set(group)]
    if (unique.length === 1) {
      unique.forEach((n) => {
        out[n] = first
      })
    } else {
      unique.forEach((n) => {
        const tokens = n.trim().split(/\s+/)
        const rest = tokens.slice(1).join(' ')
        if (!rest) {
          out[n] = n
          return
        }
        const tail = rest.length <= 2 ? rest : rest[0]
        out[n] = `${first} ${tail}`
      })
    }
  })
  return out
}
