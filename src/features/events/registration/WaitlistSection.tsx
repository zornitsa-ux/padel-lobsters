import { Clock, X } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import type { NormalisedRegistration } from '../registrationQueries'
import type { DisplayName, GetPlayer } from './utils'
import { Button } from '../../../components/ui/Button'

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
        <Clock size={16} className="text-lob-warning-solid" />
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
              avatarTone="bg-lob-warning-soft text-lob-warning"
              className="card border-l-4 border-lob-warning-border"
              prefix={
                <span className="text-xs text-lob-warning-solid w-5 text-center font-bold">
                  W{idx + 1}
                </span>
              }
              name={displayName(p)}
              subtitle={`Waitlist position ${idx + 1}`}
              trailing={
                isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="neutral" size="sm" onClick={() => onMoveToRegistered(reg)}>
                      Confirm
                    </Button>
                    <IconButton
                      onClick={() => onCancel(reg)}
                      aria-label="Remove from waitlist"
                      variant="destructive"
                      size="sm"
                    >
                      <X />
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
