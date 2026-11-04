import { Badge } from '../../../components/ui/Badge'
import { fmtEur } from '../../../lib/format'
import { formatLabel, pricePerEntry } from '../eventHelpers'
import { EventHeading } from '../EventHeading'
import type { PublicEvent } from './publicEventQueries'
import { isFull, spotsLabel } from './publicEventHelpers'

const priceLabel = ({ event }: { event: PublicEvent }): string => {
  const price = pricePerEntry(event)
  if (price <= 0) return 'Free'
  return `${fmtEur(price)}${event.entryMode === 'team' ? ' per team' : ' pp'}`
}

// Event facts for a signed-out visitor: what, when, where, cost, room left.
export function GuestEventSummary({ event }: { event: PublicEvent }) {
  return (
    <div className="flex items-start gap-3">
      <EventHeading event={event} showDuration>
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Badge tone="neutral" label={formatLabel(event.format)} />
          <Badge tone="neutral" label={priceLabel({ event })} />
          <Badge tone={isFull({ event }) ? 'warning' : 'success'} label={spotsLabel({ event })} />
        </div>
      </EventHeading>
    </div>
  )
}
