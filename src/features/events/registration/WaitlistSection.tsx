import { Clock, X } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import type { NormalisedRegistration } from '../registrationQueries'
import type { DisplayName, GetPlayer } from './utils'

interface WaitlistSectionProps {
  isCompleted: boolean
  waitlisted: NormalisedRegistration[]
  getPlayer: GetPlayer
  displayName: DisplayName
  isAdmin: boolean
  onMoveToRegistered: (reg: NormalisedRegistration) => void
  onCancel: (reg: NormalisedRegistration) => void
}

export default function WaitlistSection({
  isCompleted,
  waitlisted,
  getPlayer,
  displayName,
  isAdmin,
  onMoveToRegistered,
  onCancel,
}: WaitlistSectionProps) {
  if (isCompleted || waitlisted.length === 0) return null

  return (
    <section>
      <h3 className="font-bold text-lob-slate mb-2 flex items-center gap-2">
        <Clock size={16} className="text-orange-400" />
        Waitlist ({waitlisted.length})
      </h3>
      <div className="space-y-2">
        {waitlisted.map((reg, idx) => {
          const p = getPlayer(reg.playerId)
          if (!p) return null

          return (
            <PlayerRow
              key={reg.id}
              player={p}
              avatarTone="bg-orange-100 text-orange-600"
              className="card border-l-4 border-orange-300"
              prefix={
                <span className="text-xs text-orange-400 w-5 text-center font-bold">
                  W{idx + 1}
                </span>
              }
              name={displayName(p)}
              subtitle={`Waitlist position ${idx + 1}`}
              trailing={
                isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => onMoveToRegistered(reg)}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold"
                    >
                      Confirm
                    </button>
                    <IconButton
                      onClick={() => onCancel(reg)}
                      aria-label="Remove from waitlist"
                      variant="destructive"
                      size="sm"
                    >
                      <X size={14} />
                    </IconButton>
                  </div>
                )
              }
            />
          )
        })}
      </div>
    </section>
  )
}
