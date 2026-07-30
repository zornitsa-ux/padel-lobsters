import { ChevronDown, ChevronUp, UserX } from 'lucide-react'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import type { NormalisedRegistration } from '../registrationQueries'
import type { DisplayName, GetPlayer } from './utils'

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
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between opacity-60"
      >
        <span className="font-bold text-lob-slate flex items-center gap-2">
          <UserX size={16} />
          Cancelled ({cancelled.length})
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="space-y-2 opacity-60 mt-2">
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
      )}
    </section>
  )
}
