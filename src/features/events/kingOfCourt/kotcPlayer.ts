import { rankedTeams } from './domain'
import type { KotcTeam, StartingCourt } from './domain'
import { buildTeamEntries } from '../teams/teamEntries'
import type { EventTeam } from '../teams/teamTypes'
import type { NormalisedRegistration } from '../../../lib/normalise'

export type StartingCourtLayout = { courts: StartingCourt[]; overflowTeamIds: string[] }

export type MyStartingCourt =
  | { kind: 'court'; courtName: string; isKingCourt: boolean }
  | { kind: 'waiting'; courtName: string }
  | { kind: 'no_court' }

export type TeamPlacing = { rank: number; total: number }

export type TeamResult = { teamId: string; playerIds: string[]; finalRank: number | null }

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

// Registered teams only, ranked first. Cancelled and waitlisted teams never show,
// whatever seed or final_rank they kept.
export const teamResultsByEvent = ({
  teams,
  registrations,
}: {
  teams: EventTeam[]
  registrations: NormalisedRegistration[]
}): TeamResultsByEvent => {
  const byEvent: TeamResultsByEvent = new Map()
  for (const entry of buildTeamEntries({ teams, registrations })) {
    if (entry.status !== 'registered') continue
    const results = byEvent.get(entry.team.tournamentId) ?? []
    results.push({
      teamId: entry.team.id,
      playerIds: [entry.captain.playerId, entry.partner.playerId],
      finalRank: entry.team.finalRank,
    })
    byEvent.set(entry.team.tournamentId, results)
  }
  return new Map([...byEvent].map(([id, results]) => [id, rankedTeams({ teams: results })]))
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
