import type {
  Court,
  CourtResult,
  KotcPlayer,
  KotcTeam,
  PlayersById,
  SeededTeam,
  StartingCourt,
  TeamStrength,
} from './types'

const playerValue = (player: KotcPlayer | undefined): number | null => {
  if (!player) return null
  if (player.mmRating != null) return player.mmRating
  return player.playtomicLevel != null && player.playtomicLevel > 0 ? player.playtomicLevel : null
}

export function teamStrength({
  team,
  playersById,
}: {
  team: KotcTeam
  playersById: PlayersById
}): TeamStrength {
  const a = playerValue(playersById[team.captainId])
  const b = playerValue(playersById[team.partnerId])
  if (a == null && b == null) return { strength: 0, unrated: true }
  if (a == null || b == null) return { strength: 2 * (a ?? b ?? 0), unrated: true }
  return { strength: a + b, unrated: false }
}

const byCreatedThenId = (a: KotcTeam, b: KotcTeam) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

export function seedTeams({
  teams,
  playersById,
}: {
  teams: KotcTeam[]
  playersById: PlayersById
}): SeededTeam[] {
  const withStrength = teams.map((team) => ({ team, ...teamStrength({ team, playersById }) }))
  const pinned = withStrength
    .filter((t) => t.team.seed != null)
    .sort((a, b) => a.team.seed! - b.team.seed! || byCreatedThenId(a.team, b.team))
  const rest = withStrength
    .filter((t) => t.team.seed == null)
    .sort((a, b) => b.strength - a.strength || byCreatedThenId(a.team, b.team))
  return [...pinned, ...rest].map(({ team, strength, unrated }, i) => ({
    teamId: team.id,
    seed: i + 1,
    strength,
    unrated,
  }))
}

export function startingCourts({
  seededTeamIds,
  courts,
}: {
  seededTeamIds: string[]
  courts: Court[]
}): { courts: StartingCourt[]; overflowTeamIds: string[] } {
  const capacity = courts.length * 2
  const placed = seededTeamIds.slice(0, capacity)
  const overflowTeamIds = seededTeamIds.slice(capacity)
  const used = Math.ceil(placed.length / 2)
  const result = courts.slice(0, used).map((court, courtIndex) => {
    const teamIds = placed.slice(courtIndex * 2, courtIndex * 2 + 2)
    return { courtIndex, courtName: court.name, teamIds, waiting: teamIds.length === 1 }
  })
  return { courts: result, overflowTeamIds }
}

export function rankFromFinalCourts({
  courtResults,
}: {
  courtResults: CourtResult[]
}): Record<string, number> {
  const ranks: Record<string, number> = {}
  const assign = (teamId: string | undefined, rank: number) => {
    if (teamId === undefined) return
    if (teamId in ranks) throw new Error(`Team ${teamId} appears twice in final standings`)
    ranks[teamId] = rank
  }
  courtResults.forEach(({ first, second }, k) => {
    assign(first, 2 * k + 1)
    assign(second, 2 * k + 2)
  })
  return ranks
}

export function rankedTeams({ teams }: { teams: KotcTeam[] }): KotcTeam[] {
  const ranked = teams
    .filter((t) => t.finalRank != null)
    .sort((a, b) => a.finalRank! - b.finalRank!)
  return [...ranked, ...teams.filter((t) => t.finalRank == null)]
}
