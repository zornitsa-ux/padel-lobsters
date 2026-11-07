import { fmtEur } from '../../lib/format'
import { formatLabel, parseLocalDate, pricePerPlayer } from './eventHelpers'
import { spotsLabel } from './public/publicEventHelpers'
import type { EntryMode } from '../../lib/normalise'

// Structural subset of a tournament the share message reads. NormalisedTournament satisfies it.
export interface ShareableEvent {
  id: string | number
  name?: string | null
  date?: string | null
  time?: string | null
  duration?: number | null
  location?: string | null
  format?: string | null
  totalPrice?: string | number | null
  maxPlayers?: number | null
  entryMode?: EntryMode | null
}

export const eventShareUrl = ({ event, origin }: { event: ShareableEvent; origin: string }) =>
  `${origin}/events/${event.id}`

const whenLine = ({ date, time, duration }: ShareableEvent): string => {
  const day = parseLocalDate(date)
  const dayLabel = day
    ? day.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })
    : ''
  const timeLabel = time ? `${time}${duration ? ` (${duration} min)` : ''}` : ''
  return [dayLabel, timeLabel].filter(Boolean).join(', ')
}

const spotsLine = ({
  event,
  registeredCount,
}: {
  event: ShareableEvent
  registeredCount?: number
}): string => {
  if (registeredCount === undefined || !event.maxPlayers) return ''
  const label = spotsLabel({
    event: {
      maxPlayers: event.maxPlayers,
      registeredCount,
      entryMode: event.entryMode ?? 'individual',
    },
  })
  return label === 'Full' ? 'Full, join the waitlist' : label
}

const line = (emoji: string, text: string) => (text ? `${emoji} ${text}` : '')

/**
 * The message a member shares: the event's facts and a sign-up link. No player names: it's
 * forwarded to people outside the group.
 */
export function buildEventShareMessage({
  event,
  url,
  registeredCount,
}: {
  event: ShareableEvent
  url: string
  /** Registered players now, for a spots-left line. Omit when unknown. */
  registeredCount?: number
}): string {
  const price = pricePerPlayer(event)
  const details = [
    line('📅', whenLine(event)),
    line('📍', event.location ?? ''),
    line('🎾', event.format ? formatLabel(event.format) : ''),
    line('💶', price > 0 ? `${fmtEur(price)} per player` : ''),
    line('✅', spotsLine({ event, registeredCount })),
  ].filter(Boolean)

  const heading = `🦞 ${(event.name || 'Padel Lobsters event').toUpperCase()}`
  const body = details.length ? ['', ...details] : []
  return [heading, ...body, '', `Sign up: ${url}`].join('\n')
}
