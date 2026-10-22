import type { EventFormValues } from './eventConstants'
import type { NormalisedTournament } from '../../lib/normalise'
import type { TournamentInput } from './tournamentQueries'

export const AMERICANO = { format: 'lobster_matching', entryMode: 'individual' } as const
export const KING_OF_THE_COURT = { format: 'king_of_court', entryMode: 'team' } as const

export const FORMAT_LOCKED_NOTE = "Format can't change once people have signed up"

export const isKingOfTheCourt = ({ format }: { format: string }) => format === 'king_of_court'

export const formatOption = ({ format }: { format: string }) =>
  isKingOfTheCourt({ format }) ? KING_OF_THE_COURT : AMERICANO

export const teamsForCourts = ({ courts }: { courts: unknown[] }): number => 2 * courts.length

export function effectiveMaxPlayers({ form }: { form: EventFormValues }): number {
  if (isKingOfTheCourt(form)) return 2 * teamsForCourts({ courts: form.courts })
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

// Locked until the registrations have loaded, so an empty first render can't
// unlock it.
export function isFormatLocked({
  editing,
  serverLocked,
  registrationsPending,
  registrations,
}: {
  editing: boolean
  serverLocked: boolean
  registrationsPending: boolean
  registrations: { status?: string | null }[]
}): boolean {
  if (!editing) return false
  return serverLocked || registrationsPending || hasSignups({ registrations })
}

export function isEntryModeLocked(err: unknown): boolean {
  const message = typeof err === 'object' && err !== null && 'message' in err ? err.message : ''
  return String(message).includes('entry_mode_locked')
}

const perPersonPrice = ({ totalPrice, maxPlayers }: NormalisedTournament) =>
  totalPrice > 0 && maxPlayers > 0
    ? (totalPrice / maxPlayers).toFixed(2).replace(/\.00$/, '')
    : String(totalPrice ?? '')

export function formFromTournament({ tournament: t }: { tournament: NormalisedTournament }) {
  return {
    name: t.name || '',
    date: t.date || '',
    time: t.time || '',
    location: t.location || '',
    maxPlayers: String(t.maxPlayers || 16),
    duration: t.duration || 90,
    format: t.format || 'lobster_matching',
    entryMode: t.entryMode || 'individual',
    genderMode: t.genderMode || 'mixed',
    courts: t.courts?.length
      ? t.courts.map((c) => ({ name: c.name || '', booked: !!c.booked }))
      : [{ name: '', booked: false }],
    pricePerPerson: perPersonPrice(t),
    tikkieLink: t.tikkieLink || '',
    notes: t.notes || '',
  } satisfies EventFormValues
}
