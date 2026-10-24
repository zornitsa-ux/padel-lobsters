import type { NormalisedRegistration } from '../registrationQueries'
import type { TeamEntry } from '../teams/teamTypes'

export interface PaymentRows {
  regs: NormalisedRegistration[]
  partnerIdByRegId: Map<string, string>
}

// A team pays once, through the captain's row; the partner's 'covered' row is
// never listed. Waitlisted teams are excluded, as waitlisted players are.
export function buildPaymentRows({
  teamMode,
  registrations,
  teamEntries,
}: {
  teamMode: boolean
  registrations: NormalisedRegistration[]
  teamEntries: TeamEntry[]
}): PaymentRows {
  if (!teamMode) {
    return {
      regs: registrations.filter((r) => r.status === 'registered'),
      partnerIdByRegId: new Map(),
    }
  }
  const entries = teamEntries.filter((e) => e.status === 'registered')
  return {
    regs: entries.map((e) => e.captain),
    partnerIdByRegId: new Map(entries.map((e) => [e.captain.id, e.partner.playerId])),
  }
}
