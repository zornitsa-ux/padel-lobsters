import DateTile from '../../components/ui/DateTile'
import { Badge } from '../../components/ui/Badge'
import type { BadgeProps } from '../../components/ui/Badge'
import { LinkCard } from '../../components/ui/LinkCard'
import type { NormalisedTournament } from '../../lib/normalise'

const STATUS_BADGE: Record<string, Pick<BadgeProps, 'variant' | 'label'>> = {
  upcoming: { variant: 'info', label: 'Upcoming' },
  active: { variant: 'paid', label: 'Live' },
  completed: { variant: 'silver', label: 'Completed' },
}

interface EventCardProps {
  tournament: NormalisedTournament
  past?: boolean
}

export function EventCard({ tournament: t, past = false }: EventCardProps) {
  const badge = STATUS_BADGE[t.status ?? ''] ?? STATUS_BADGE.upcoming
  const details = [t.time, t.location].filter(Boolean).join(' · ')
  return (
    <LinkCard
      to={`/events/${t.id}`}
      className={past ? 'opacity-80' : undefined}
      leading={<DateTile date={t.date} size="sm" className={past ? 'grayscale' : ''} />}
      title={t.name}
      subtitle={details || undefined}
      trailing={<Badge {...badge} />}
    />
  )
}
