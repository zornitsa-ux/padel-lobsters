import { eventTimeGroup, isEventUpcoming } from '../eventPhase'
import type { PublicEvent } from './publicEventQueries'

type CountedEvent = Pick<PublicEvent, 'maxPlayers' | 'registeredCount' | 'entryMode'>

// A team entry holds two registrations, so capacity is counted in entries.
const entrySize = ({ event }: { event: CountedEvent }) => (event.entryMode === 'team' ? 2 : 1)

export const spotsLeft = ({ event }: { event: CountedEvent }): number =>
  Math.max(0, Math.floor((event.maxPlayers - event.registeredCount) / entrySize({ event })))

export const isFull = ({ event }: { event: CountedEvent }): boolean => spotsLeft({ event }) === 0

export const spotsLabel = ({ event }: { event: CountedEvent }): string => {
  const left = spotsLeft({ event })
  if (left === 0) return 'Full'
  const unit = event.entryMode === 'team' ? 'team' : 'spot'
  return `${left} ${unit}${left === 1 ? '' : 's'} left`
}

// Scheduled, not over, and not an Americano past its date awaiting results.
export const isOpenToJoin = ({ event, now = new Date() }: { event: PublicEvent; now?: Date }) =>
  isEventUpcoming({ tournament: event, now }) &&
  eventTimeGroup({ tournament: event, now }) === 'upcoming'

export const upcomingPublicEvents = ({
  events,
  now = new Date(),
}: {
  events: PublicEvent[]
  now?: Date
}): PublicEvent[] => events.filter((event) => isOpenToJoin({ event, now }))

export const joinPath = ({ event }: { event: Pick<PublicEvent, 'id'> }): string =>
  `/events/${event.id}/join?signup=1`
