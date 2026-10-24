import { biggestClimbers, courtMoves, rankedTeams, seedTeams } from './domain'
import type { Court, CourtMove, KotcTeam, PlayersById, StartingCourt } from './domain'
import { toCourts, toKotcTeam } from './kotcInputs'
import { buildTeamEntries } from '../teams/teamEntries'
import type { EventTeam, TeamEntry } from '../teams/teamTypes'
import type { NormalisedRegistration } from '../../../lib/normalise'

export type StartingCourtLayout = { courts: StartingCourt[]; overflowTeamIds: string[] }

export type MyStartingCourt =
  | { kind: 'court'; courtName: string; isKingCourt: boolean }
  | { kind: 'waiting'; courtName: string }
  | { kind: 'no_court' }

export type TeamPlacing = { rank: number; total: number }

export type TeamResult = {
  teamId: string
  playerIds: string[]
  finalRank: number | null
  move: CourtMove | null
}

export type CourtMoveText = { journey: string; change: string }

export type TeamResultsByEvent = Map<string, TeamResult[]>

export const courtLabel = ({ court }: { court: Pick<StartingCourt, 'courtName' | 'courtIndex'> }) =>
  court.courtName || `Court ${court.courtIndex + 1}`

export const myStartingCourt = ({
  layout,
  teamId,
}: {
  layout: StartingCourtLayout
  teamId: string | null
}): MyStartingCourt | null => {
  if (!teamId) return null
  const playing = layout.courts.find((c) => c.teamIds.includes(teamId))
  if (playing) {
    return {
      kind: 'court',
      courtName: courtLabel({ court: playing }),
      isKingCourt: playing.courtIndex === 0,
    }
  }
  const waiting = layout.courts.find((c) => c.waitingTeamId === teamId)
  if (waiting) return { kind: 'waiting', courtName: courtLabel({ court: waiting }) }
  return layout.overflowTeamIds.includes(teamId) ? { kind: 'no_court' } : null
}

export const startingCourtLine = ({ startingCourt }: { startingCourt: MyStartingCourt }) => {
  switch (startingCourt.kind) {
    case 'court':
      return `You start on ${startingCourt.courtName}${startingCourt.isKingCourt ? ', the King court' : ''}`
    case 'waiting':
      return `You wait for the first game on ${startingCourt.courtName}`
    case 'no_court':
      return "Your starting court isn't set yet"
  }
}

// Total counts every registered team, ranked or not: partial standings are fine (D-026).
export const teamPlacing = ({
  teams,
  teamId,
}: {
  teams: KotcTeam[]
  teamId: string | null
}): TeamPlacing | null => {
  const rank = teams.find((t) => t.id === teamId)?.finalRank
  return rank != null ? { rank, total: teams.length } : null
}

// The same saved order and courts as the event's own views (useKingOfCourtTeams).
const eventTeamResults = ({
  entries,
  courts,
  playersById,
}: {
  entries: TeamEntry[]
  courts: Court[]
  playersById: PlayersById
}): TeamResult[] => {
  const teams = entries.map((entry) => toKotcTeam({ entry }))
  const seededTeamIds = seedTeams({ teams, playersById }).map((t) => t.teamId)
  const moves = courtMoves({ seededTeamIds, courts, teams })
  const results = entries.map((entry) => ({
    teamId: entry.team.id,
    playerIds: [entry.captain.playerId, entry.partner.playerId],
    finalRank: entry.team.finalRank,
    move: moves[entry.team.id] ?? null,
  }))
  return rankedTeams({ teams: results })
}

// Registered teams only, ranked first. Cancelled and waitlisted teams never show,
// whatever seed or final_rank they kept.
export const teamResultsByEvent = ({
  teams,
  registrations,
  tournaments,
  playersById,
}: {
  teams: EventTeam[]
  registrations: NormalisedRegistration[]
  tournaments: { id: string; courts?: unknown }[]
  playersById: PlayersById
}): TeamResultsByEvent => {
  const entriesByEvent = new Map<string, TeamEntry[]>()
  for (const entry of buildTeamEntries({ teams, registrations })) {
    if (entry.status !== 'registered') continue
    const entries = entriesByEvent.get(entry.team.tournamentId) ?? []
    entries.push(entry)
    entriesByEvent.set(entry.team.tournamentId, entries)
  }
  const courtsOf = new Map(tournaments.map((t) => [t.id, toCourts({ courts: t.courts })]))
  return new Map(
    [...entriesByEvent].map(([id, entries]) => [
      id,
      eventTeamResults({ entries, courts: courtsOf.get(id) ?? [], playersById }),
    ]),
  )
}

export const teamResultLabel = ({
  result,
  nameOf,
}: {
  result: TeamResult
  nameOf: (playerId: string) => string
}) => result.playerIds.map(nameOf).filter(Boolean).join(' & ')

export const eventWinner = ({ results }: { results: TeamResult[] | undefined }) =>
  results?.[0]?.finalRank === 1 ? results[0] : null

export const eventClimbers = <T extends Pick<TeamResult, 'teamId' | 'move'>>({
  results,
}: {
  results: T[] | undefined
}): T[] => {
  const moves = Object.fromEntries(
    (results ?? []).flatMap((r) => (r.move ? [[r.teamId, r.move]] : [])),
  )
  const ids = new Set(biggestClimbers({ moves }))
  return (results ?? []).filter((r) => ids.has(r.teamId))
}

const moveCourtLabel = ({ courts, courtIndex }: { courts: Court[]; courtIndex: number }) =>
  courtIndex === 0
    ? 'King court'
    : courtLabel({ court: { courtName: courts[courtIndex]?.name ?? '', courtIndex } })

// D-028: "Court 5 → King court ↑4"; a team that stayed names one court.
export const courtMoveText = ({
  move,
  courts,
}: {
  move: CourtMove
  courts: Court[]
}): CourtMoveText => {
  const start = moveCourtLabel({ courts, courtIndex: move.startCourtIndex })
  if (move.gained === 0) {
    return { journey: start, change: move.startCourtIndex === 0 ? 'held' : '=' }
  }
  const final = moveCourtLabel({ courts, courtIndex: move.finalCourtIndex })
  return {
    journey: `${start} → ${final}`,
    change: move.gained > 0 ? `↑${move.gained}` : `↓${-move.gained}`,
  }
}
