import type { LeagueTeam, LeagueMatch, GroupStanding } from './types'

interface TeamRecord {
  wins: number
  losses: number
  setDiff: number
  gameDiff: number
}

function accumulateRecord(teamId: string, match: LeagueMatch): TeamRecord {
  const isTeam1 = match.team1_id === teamId
  const won = match.winner_id === teamId

  let setsWon = 0
  let setsLost = 0
  let gamesWon = 0
  let gamesLost = 0

  for (const set of match.set_scores ?? []) {
    const myScore = isTeam1 ? set.t1 : set.t2
    const theirScore = isTeam1 ? set.t2 : set.t1
    gamesWon += myScore
    gamesLost += theirScore
    if (myScore > theirScore) setsWon++
    else if (theirScore > myScore) setsLost++
  }

  return {
    wins: won ? 1 : 0,
    losses: won ? 0 : 1,
    setDiff: setsWon - setsLost,
    gameDiff: gamesWon - gamesLost,
  }
}

function playedGroupMatches(matches: LeagueMatch[]): LeagueMatch[] {
  return matches.filter((m) => m.stage === 'group' && m.winner_id !== null)
}

export function getTeamRecord(
  teamId: string,
  matches: LeagueMatch[],
): { wins: number; losses: number; setDiff: number; gameDiff: number } {
  const relevant = playedGroupMatches(matches).filter(
    (m) => m.team1_id === teamId || m.team2_id === teamId,
  )

  let wins = 0
  let losses = 0
  let setDiff = 0
  let gameDiff = 0

  for (const m of relevant) {
    const r = accumulateRecord(teamId, m)
    wins += r.wins
    losses += r.losses
    setDiff += r.setDiff
    gameDiff += r.gameDiff
  }

  return { wins, losses, setDiff, gameDiff }
}

/** Head-to-head wins for teamA directly against teamB in the played group matches. */
function h2hWins(teamA: string, teamB: string, played: LeagueMatch[]): number {
  return played.filter(
    (m) =>
      ((m.team1_id === teamA && m.team2_id === teamB) ||
        (m.team1_id === teamB && m.team2_id === teamA)) &&
      m.winner_id === teamA,
  ).length
}

export function computeGroupStandings(
  teams: LeagueTeam[],
  matches: LeagueMatch[],
): GroupStanding[] {
  const played = playedGroupMatches(matches)

  // Build per-team record
  const records = new Map<string, TeamRecord>()
  for (const team of teams) {
    records.set(team.id, { wins: 0, losses: 0, setDiff: 0, gameDiff: 0 })
  }

  for (const m of played) {
    for (const teamId of [m.team1_id, m.team2_id]) {
      if (teamId !== null && records.has(teamId)) {
        const r = accumulateRecord(teamId, m)
        const existing = records.get(teamId)!
        records.set(teamId, {
          wins: existing.wins + r.wins,
          losses: existing.losses + r.losses,
          setDiff: existing.setDiff + r.setDiff,
          gameDiff: existing.gameDiff + r.gameDiff,
        })
      }
    }
  }

  // Build standings list (preserve original order for stable sort)
  const standings: Omit<GroupStanding, 'rank'>[] = teams.map((team) => {
    const rec = records.get(team.id) ?? { wins: 0, losses: 0, setDiff: 0, gameDiff: 0 }
    return {
      team,
      wins: rec.wins,
      losses: rec.losses,
      points: rec.wins,
      setDiff: rec.setDiff,
      gameDiff: rec.gameDiff,
    }
  })

  // Sort with tiebreakers
  standings.sort((a, b) => {
    // 1. Points (wins)
    if (b.points !== a.points) return b.points - a.points

    // 2. Head-to-head
    const aWinsH2H = h2hWins(a.team.id, b.team.id, played)
    const bWinsH2H = h2hWins(b.team.id, a.team.id, played)
    if (aWinsH2H !== bWinsH2H) return bWinsH2H - aWinsH2H

    // 3. Set difference
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff

    // 4. Game difference
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff

    // 5. Stable (preserve input order — Array.sort is stable in V8/Node 11+)
    return 0
  })

  // Assign rank
  return standings.map((s, i) => ({ ...s, rank: i + 1 }))
}
