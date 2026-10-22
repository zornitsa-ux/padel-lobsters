import type { NormalisedRegistration } from '../../../lib/normalise'
import type { EventTeam, TeamEntry } from './teamTypes'

const isActive = (r: NormalisedRegistration) => r.status === 'registered' || r.status === 'waitlist'

const toEntry = (team: EventTeam, rows: NormalisedRegistration[]): TeamEntry | null => {
  const captain = rows.find((r) => r.playerId === team.captainId)
  const partner = rows.find((r) => r.playerId !== team.captainId)
  if (rows.length !== 2 || !captain || !partner) return null
  return {
    team,
    status: captain.status as TeamEntry['status'],
    captain,
    partner,
    confirmed: partner.acceptedAt !== null,
  }
}

// Active teams only, in the order the waitlist promotes (oldest first).
export function buildTeamEntries({
  teams,
  registrations,
}: {
  teams: EventTeam[]
  registrations: NormalisedRegistration[]
}): TeamEntry[] {
  const activeByTeam = new Map<string, NormalisedRegistration[]>()
  for (const r of registrations) {
    if (!r.teamId || !isActive(r)) continue
    activeByTeam.set(r.teamId, [...(activeByTeam.get(r.teamId) ?? []), r])
  }
  return [...teams]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((team) => toEntry(team, activeByTeam.get(team.id) ?? []))
    .filter((entry): entry is TeamEntry => entry !== null)
}
