import { eventTimeGroup, isEventOver } from '../eventPhase'
import { teamCount } from '../registration/team/teamHelpers'
import type { PublicEvent } from './publicEventQueries'

type CountedEvent = Pick<PublicEvent, 'maxPlayers' | 'registeredCount' | 'entryMode'>

// A team entry holds two registrations; capacity matches the members' roster line.
export const spotsLeft = ({ event }: { event: CountedEvent }): number => {
  const left =
    event.entryMode === 'team'
      ? teamCount({ players: event.maxPlayers }) - teamCount({ players: event.registeredCount })
      : event.maxPlayers - event.registeredCount
  return Math.max(0, left)
}

export const isFull = ({ event }: { event: CountedEvent }): boolean => spotsLeft({ event }) === 0

export const spotsLabel = ({ event }: { event: CountedEvent }): string => {
  const left = spotsLeft({ event })
  if (left === 0) return 'Full'
  const unit = event.entryMode === 'team' ? 'team' : 'spot'
  return `${left} ${unit}${left === 1 ? '' : 's'} left`
}

// Taking sign-ups: still 'upcoming' (not started), not over, and not an
// Americano past its date awaiting results.
export const isOpenToJoin = ({ event, now = new Date() }: { event: PublicEvent; now?: Date }) =>
  event.status === 'upcoming' &&
  !isEventOver({ tournament: event, now }) &&
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
