import DateTile from '../../components/ui/DateTile'
import { Badge } from '../../components/ui/Badge'
import { LinkCard } from '../../components/ui/LinkCard'
import type { NormalisedTournament } from '../../lib/normalise'

/** An event past its date whose results aren't in yet (D-031). */
export function AwaitingResultsCard({ tournament: t }: { tournament: NormalisedTournament }) {
  const details = [t.time, t.location].filter(Boolean).join(' · ')
  return (
    <LinkCard
      to={`/events/${t.id}`}
      className="opacity-80"
      leading={<DateTile date={t.date} size="sm" className="grayscale" />}
      title={t.name}
      subtitle={details || undefined}
      trailing={<Badge variant="pending" label="Results pending" />}
    />
  )
}
