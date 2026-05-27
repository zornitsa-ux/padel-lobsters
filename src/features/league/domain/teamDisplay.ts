import type { LeagueTeam } from './types'

export function resolveTeamName(team: LeagueTeam): string {
  if (team.team_name) return team.team_name
  const p1 = team.player1?.name ?? '?'
  const p2 = team.player2?.name ?? '?'
  return `${p1} & ${p2}`
}

export function resolveTeamShortName(team: LeagueTeam): string {
  if (team.team_name) return team.team_name
  const p1 = team.player1?.name?.split(' ')[0] ?? '?'
  const p2 = team.player2?.name?.split(' ')[0] ?? '?'
  return `${p1} & ${p2}`
}

// Full player names ("P1 & P2"). Returns null when the team has no distinct
// team name, since resolveTeamName/resolveTeamShortName already show the players.
export function resolveTeamPlayers(team: LeagueTeam): string | null {
  if (!team.team_name) return null
  const p1 = team.player1?.name ?? '?'
  const p2 = team.player2?.name ?? '?'
  return `${p1} & ${p2}`
}
