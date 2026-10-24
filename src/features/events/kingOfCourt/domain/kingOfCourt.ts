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

// Owner decision (2026-10-24): team events seed on reported Playtomic levels,
// never the learned rating. Level 0 means not reported.
const playerValue = (player: KotcPlayer | undefined): number | null =>
  player?.playtomicLevel != null && player.playtomicLevel > 0 ? player.playtomicLevel : null

export function teamStrength({
  team,
  playersById,
}: {
  team: KotcTeam
  playersById: PlayersById
}): TeamStrength {
  const a = playerValue(playersById[team.captainId])
  const b = playerValue(playersById[team.partnerId])
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

// OQ-4: an odd team waits at the bottom court in play (court 1 if none is).
// Teams beyond the courts' capacity overflow.
export function startingCourts({
  seededTeamIds,
  courts,
}: {
  seededTeamIds: string[]
  courts: Court[]
}): { courts: StartingCourt[]; overflowTeamIds: string[] } {
  const pairs = Math.min(Math.floor(seededTeamIds.length / 2), courts.length)
  const rest = seededTeamIds.slice(pairs * 2)
  const waitingTeamId = rest.length === 1 && courts.length > 0 ? rest[0] : null
  const overflowTeamIds = waitingTeamId ? [] : rest
  const used = waitingTeamId ? Math.max(pairs, 1) : pairs
  const result = courts.slice(0, used).map((court, courtIndex) => ({
    courtIndex,
    courtName: court.name,
    teamIds: seededTeamIds.slice(courtIndex * 2, Math.min(courtIndex * 2 + 2, pairs * 2)),
    waitingTeamId: courtIndex === used - 1 ? waitingTeamId : null,
  }))
  return { courts: result, overflowTeamIds }
}

export function rankFromFinalCourts({
  courtResults,
}: {
  courtResults: CourtResult[]
}): Record<string, number> {
  const ranks: Record<string, number> = {}
  const assign = (teamId: string | null | undefined, rank: number) => {
    if (!teamId) return
    if (teamId in ranks) throw new Error(`Team ${teamId} appears twice in final standings`)
    ranks[teamId] = rank
  }
  courtResults.forEach(({ first, second }, k) => {
    assign(first, 2 * k + 1)
    assign(second, 2 * k + 2)
  })
  return ranks
}

export function rankedTeams<T extends Pick<KotcTeam, 'finalRank'>>({ teams }: { teams: T[] }): T[] {
  const ranked = teams
    .filter((t) => t.finalRank != null)
    .sort((a, b) => a.finalRank! - b.finalRank!)
  return [...ranked, ...teams.filter((t) => t.finalRank == null)]
}
