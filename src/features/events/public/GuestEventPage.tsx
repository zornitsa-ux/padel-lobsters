import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { CalendarCheck, LogIn, UserPlus } from 'lucide-react'
import { PageHeader } from '../../../components/ui/PageHeader'
import { RouteFallback } from '../../../components/ui/RouteFallback'
import { EmptyState } from '../../../components/ui/EmptyState'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Button } from '../../../components/ui/Button'
import { ActionRow } from '../../../components/ui/ActionRow'
import EventDescription from '../EventDescription'
import ShareEventButton from '../ShareEventButton'
import { usePublicEvents } from './usePublicEvents'
import { isFull, isOpenToJoin, joinPath } from './publicEventHelpers'
import { GuestEventSummary } from './GuestEventSummary'
import type { PublicEvent } from './publicEventQueries'
import { loadFailed } from '../../../lib/queryState'
import { withShareTags } from '../shareTags'

function usePublicEventFromUrl() {
  const { id } = useParams()
  const query = usePublicEvents()
  const event: PublicEvent | null = (query.data ?? []).find((e) => e.id === id) ?? null
  return { event, isPending: query.isPending, failed: loadFailed(query) }
}

const noEdit = () => undefined

// Signed-out shell for /events/:id: the event's name, and no member tabs.
export function GuestEventShell() {
  const { event, isPending, failed } = usePublicEventFromUrl()
  if (isPending) return <RouteFallback />
  // Keep the shared URL on a failed load so a reload can still reach the event.
  if (failed) {
    return <AlertBox variant="error">Couldn&apos;t load this event. Reload to try again.</AlertBox>
  }
  if (!event) return <Navigate to="/events" replace />
  return (
    <div className="-mx-4">
      <PageHeader
        title={event.name}
        backLink={{ to: '/events', label: 'Events' }}
        rightAction={
          <ShareEventButton
            event={event}
            registeredCount={event.registeredCount}
            placement="guest-header"
          />
        }
      />
      <div className="px-4 pt-4">
        <Outlet />
      </div>
    </div>
  )
}

function JoinActions({ event }: { event: PublicEvent }) {
  const { search } = useLocation()
  const full = isFull({ event })
  return (
    <div className="space-y-3">
      {full && (
        <AlertBox variant="warning" size="sm" title="This event is full">
          Someone usually cancels. Join and you&apos;ll go on the waitlist.
        </AlertBox>
      )}
      <ActionRow>
        <Button to={withShareTags({ path: joinPath({ event }), search })} icon={<UserPlus />} grow>
          {full ? 'Join to get on the waitlist' : 'Join to play'}
        </Button>
        <Button
          to={withShareTags({ path: `/events/${event.id}/join`, search })}
          variant="secondary"
          icon={<LogIn />}
        >
          Sign in
        </Button>
      </ActionRow>
    </div>
  )
}

// Signed-out /events/:id/info: event facts and a way in. No player names.
export function GuestEventInfo() {
  const { event } = usePublicEventFromUrl()
  if (!event) return null
  const open = isOpenToJoin({ event })
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <GuestEventSummary event={event} />
        {open && <JoinActions event={event} />}
      </div>
      {!open && (
        <EmptyState
          icon={<CalendarCheck />}
          title="Sign-ups are closed"
          description="See what's coming up next."
          action={<Button to="/events">Upcoming events</Button>}
        />
      )}
      <EventDescription tournament={event} isAdmin={false} onSave={noEdit} />
    </div>
  )
}
