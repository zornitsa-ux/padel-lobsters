import { Building2, Calendar } from 'lucide-react'
import DateTile from '../../../components/ui/DateTile'
import { Badge } from '../../../components/ui/Badge'
import { fmtEur } from '../../../lib/format'
import { formatDate, formatLabel, pricePerEntry } from '../eventHelpers'
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
      <DateTile date={event.date} size="md" />
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-bold text-lob-dark">{event.name}</h3>
        <p className="text-sm font-semibold text-lob-slate flex items-center gap-1">
          <Calendar size={13} /> {formatDate(event.date)}
          {event.time && <span className="text-lob-muted">· {event.time}</span>}
          <span className="text-lob-muted">· {event.duration}min</span>
        </p>
        {event.location && (
          <p className="text-xs text-lob-teal flex items-center gap-1">
            <Building2 size={11} /> {event.location}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge tone="neutral" label={formatLabel(event.format)} />
          <Badge tone="neutral" label={priceLabel({ event })} />
          <Badge tone={isFull({ event }) ? 'warning' : 'success'} label={spotsLabel({ event })} />
        </div>
      </div>
    </div>
  )
}
