import type { NormalisedRegistration } from '../../../lib/normalise'
import { isActiveRegistration } from '../registration/utils'
import type { EventTeam, TeamEntry } from './teamTypes'

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

// Teams that active registrations point at but the team list doesn't hold yet.
export function missingTeamIds({
  teams,
  registrations,
}: {
  teams: EventTeam[]
  registrations: NormalisedRegistration[]
}): string[] {
  const known = new Set(teams.map((t) => t.id))
  const missing = registrations
    .filter((r) => r.teamId && isActiveRegistration(r) && !known.has(r.teamId))
    .map((r) => r.teamId as string)
  return [...new Set(missing)].sort()
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
    if (!r.teamId || !isActiveRegistration(r)) continue
    activeByTeam.set(r.teamId, [...(activeByTeam.get(r.teamId) ?? []), r])
  }
  return [...teams]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((team) => toEntry(team, activeByTeam.get(team.id) ?? []))
    .filter((entry): entry is TeamEntry => entry !== null)
}
