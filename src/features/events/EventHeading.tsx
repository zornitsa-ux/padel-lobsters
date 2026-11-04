import type { ReactNode } from 'react'
import { Building2, Calendar } from 'lucide-react'
import DateTile from '../../components/ui/DateTile'
import { formatDate } from './eventHelpers'

interface HeadingEvent {
  name: string
  date: string
  time: string
  location: string
  duration: number
}

// Date tile plus name, date/time and venue: the start of every event card.
// The parent lays it out in a row; `children` sits under the venue line.
export function EventHeading({
  event,
  showDuration = false,
  children,
}: {
  event: HeadingEvent
  showDuration?: boolean
  children?: ReactNode
}) {
  return (
    <>
      <DateTile date={event.date} size="md" />
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-lob-dark truncate">{event.name}</h3>
        <p className="text-sm font-semibold text-lob-slate flex items-center gap-1 mt-0.5">
          <Calendar size={13} /> {formatDate(event.date)}
          {event.time && <span className="text-lob-muted">· {event.time}</span>}
          {showDuration && <span className="text-lob-muted">· {event.duration}min</span>}
        </p>
        {event.location && (
          <p className="text-xs text-lob-teal flex items-center gap-1 mt-0.5">
            <Building2 size={11} /> {event.location}
          </p>
        )}
        {children}
      </div>
    </>
  )
}
