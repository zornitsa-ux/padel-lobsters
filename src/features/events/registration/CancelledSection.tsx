import { UserX } from 'lucide-react'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import type { NormalisedRegistration } from '../registrationQueries'
import type { DisplayName, GetPlayer } from './utils'
import { CollapsibleCard } from '../../../components/ui/CollapsibleCard'

interface CancelledSectionProps {
  isCompleted: boolean
  cancelled: NormalisedRegistration[]
  getPlayer: GetPlayer
  displayName: DisplayName
  expanded: boolean
  onToggle: () => void
}

export default function CancelledSection({
  isCompleted,
  cancelled,
  getPlayer,
  displayName,
  expanded,
  onToggle,
}: CancelledSectionProps) {
  if (isCompleted || cancelled.length === 0) return null

  return (
    <CollapsibleCard
      className=""
      muted
      expanded={expanded}
      onToggle={onToggle}
      header={
        <span className="font-bold text-lob-slate flex items-center gap-2">
          <UserX size={16} />
          Cancelled ({cancelled.length})
        </span>
      }
    >
      <div className="space-y-2 mt-2">
        {cancelled.map((reg) => {
          const p = getPlayer(reg.playerId)
          if (!p) return null

          return (
            <PlayerRow
              key={reg.id}
              player={p}
              avatarTone="bg-lob-teal-light text-lob-muted"
              className="card"
              name={displayName(p)}
              nameClassName="text-sm text-lob-muted line-through"
            />
          )
        })}
      </div>
    </CollapsibleCard>
  )
}
