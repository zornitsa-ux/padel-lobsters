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

type Standing = Omit<GroupStanding, 'rank'>

/**
 * H2H wins for a team against other members of a specific tied sub-group.
 * When the tied group has a circular dependency (A beat B, B beat C, C beat A),
 * every team gets the same count and this tiebreaker is inconclusive — callers
 * fall through to set diff and game diff.
 */
function h2hWinsInGroup(teamId: string, groupIds: Set<string>, played: LeagueMatch[]): number {
  return played.filter(
    (m) =>
      m.winner_id === teamId &&
      ((m.team1_id === teamId && m.team2_id !== null && groupIds.has(m.team2_id)) ||
        (m.team2_id === teamId && m.team1_id !== null && groupIds.has(m.team1_id))),
  ).length
}

/**
 * Sort a group of teams all tied on wins.
 *
 * Tiebreakers (in order):
 * 1. H2H wins within this tied sub-group — resolves clean 2-way or non-circular
 *    multi-team ties; produces equal counts for circular ties (e.g. rock-paper-scissors),
 *    which then falls through.
 * 2. Overall set difference
 * 3. Overall game difference
 */
function sortTiedGroup(group: Standing[], played: LeagueMatch[]): Standing[] {
  if (group.length <= 1) return group

  const groupIds = new Set(group.map((s) => s.team.id))

  return [...group].sort((a, b) => {
    const aH2H = h2hWinsInGroup(a.team.id, groupIds, played)
    const bH2H = h2hWinsInGroup(b.team.id, groupIds, played)
    if (bH2H !== aH2H) return bH2H - aH2H

    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff

    return b.gameDiff - a.gameDiff
  })
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

  // Build standings list
  const standings: Standing[] = teams.map((team) => {
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

  // Group by wins, sort each win-group with proper tiebreakers, then flatten
  const byWins = new Map<number, Standing[]>()
  for (const s of standings) {
    const arr = byWins.get(s.wins) ?? []
    arr.push(s)
    byWins.set(s.wins, arr)
  }

  const sorted: Standing[] = []
  for (const w of [...byWins.keys()].sort((a, b) => b - a)) {
    sorted.push(...sortTiedGroup(byWins.get(w)!, played))
  }

  return sorted.map((s, i) => ({ ...s, rank: i + 1 }))
}
