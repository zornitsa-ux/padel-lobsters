import type { EventFormValues } from './eventConstants'
import type { TournamentInput } from './tournamentQueries'

export const AMERICANO = { format: 'lobster_matching', entryMode: 'individual' } as const
export const KING_OF_THE_COURT = { format: 'king_of_court', entryMode: 'team' } as const

export const FORMAT_LOCKED_NOTE = "Format can't change once people have signed up"

export const isKingOfTheCourt = ({ format }: { format: string }) => format === 'king_of_court'

export const formatOption = ({ format }: { format: string }) =>
  isKingOfTheCourt({ format }) ? KING_OF_THE_COURT : AMERICANO

export function effectiveMaxTeams({ form }: { form: EventFormValues }): number {
  const typed = parseInt(String(form.maxTeams ?? ''))
  return typed > 0 ? typed : 2 * form.courts.length
}

export function effectiveMaxPlayers({ form }: { form: EventFormValues }): number {
  if (isKingOfTheCourt(form)) return 2 * effectiveMaxTeams({ form })
  return parseInt(String(form.maxPlayers)) || 16
}

export function teamTotal({ pricePerPerson }: { pricePerPerson: string | number }): number {
  return 2 * (parseFloat(String(pricePerPerson)) || 0)
}

export function buildEventData({ form }: { form: EventFormValues }): TournamentInput {
  const maxPlayers = effectiveMaxPlayers({ form })
  return {
    name: form.name,
    date: form.date,
    time: form.time,
    location: form.location,
    maxPlayers,
    format: form.format,
    entryMode: formatOption({ format: form.format }).entryMode,
    genderMode: form.genderMode,
    duration: parseInt(String(form.duration)) || 90,
    totalPrice: (parseFloat(String(form.pricePerPerson)) || 0) * maxPlayers,
    tikkieLink: form.tikkieLink || '',
    courts: form.courts.map((c) => ({ name: c.name, booked: !!c.booked })),
    notes: form.notes,
  }
}

export function hasSignups({
  registrations,
}: {
  registrations: { status?: string | null }[]
}): boolean {
  return registrations.some((r) => r.status === 'registered' || r.status === 'waitlist')
}

export function isEntryModeLocked(err: unknown): boolean {
  const message = typeof err === 'object' && err !== null && 'message' in err ? err.message : ''
  return String(message).includes('entry_mode_locked')
}

export function maxTeamsFromTournament({
  format,
  maxPlayers,
}: {
  format?: string | null
  maxPlayers?: number | string | null
}): string {
  if (!isKingOfTheCourt({ format: format ?? '' })) return ''
  const teams = (parseInt(String(maxPlayers)) || 0) / 2
  return teams > 0 ? String(teams) : ''
}
