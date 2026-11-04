import { Trophy } from 'lucide-react'
import { PageHeader } from '../../../components/ui/PageHeader'
import { CardLink } from '../../../components/ui/CardLink'
import { EmptyState } from '../../../components/ui/EmptyState'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Spinner } from '../../../components/ui/Spinner'
import { loadFailed } from '../../../lib/queryState'
import { usePublicEvents } from './usePublicEvents'
import { upcomingPublicEvents } from './publicEventHelpers'
import { GuestEventSummary } from './GuestEventSummary'

// The signed-out Events page: upcoming events only, no past events or results.
export default function GuestEvents() {
  const query = usePublicEvents()
  const upcoming = upcomingPublicEvents({ events: query.data ?? [] })

  return (
    <div className="-mx-4">
      <PageHeader title="Events" />
      <div className="px-4 pt-4 space-y-3">
        {query.isPending && <Spinner />}
        {loadFailed(query) && (
          <AlertBox variant="error">Couldn&apos;t load the events. Reload to try again.</AlertBox>
        )}
        {query.isSuccess && upcoming.length === 0 && (
          <EmptyState
            icon={<Trophy />}
            title="No upcoming events right now"
            description="Check back soon, the next one is around the corner."
          />
        )}
        {upcoming.map((event) => (
          <CardLink key={event.id} to={`/events/${event.id}/info`}>
            <GuestEventSummary event={event} />
          </CardLink>
        ))}
      </div>
    </div>
  )
}
