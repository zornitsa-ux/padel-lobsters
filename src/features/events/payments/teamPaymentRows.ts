import type { NormalisedRegistration } from '../registrationQueries'
import { buildTeamEntries } from '../teams/teamEntries'
import type { EventTeam } from '../teams/teamTypes'

export interface PaymentRows {
  regs: NormalisedRegistration[]
  partnerIdByRegId: Map<string, string>
  unitsPerRow: 1 | 2
}

// A team pays once, through the captain's row; the partner's 'covered' row is
// never listed. Waitlisted teams are excluded, as waitlisted players are.
export function buildPaymentRows({
  teamMode,
  registrations,
  teams,
}: {
  teamMode: boolean
  registrations: NormalisedRegistration[]
  teams: EventTeam[]
}): PaymentRows {
  if (!teamMode) {
    return {
      regs: registrations.filter((r) => r.status === 'registered'),
      partnerIdByRegId: new Map(),
      unitsPerRow: 1,
    }
  }
  const entries = buildTeamEntries({ teams, registrations }).filter(
    (e) => e.status === 'registered',
  )
  return {
    regs: entries.map((e) => e.captain),
    partnerIdByRegId: new Map(entries.map((e) => [e.captain.id, e.partner.playerId])),
    unitsPerRow: 2,
  }
}
