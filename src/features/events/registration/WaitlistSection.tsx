import { Clock, X } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import type { NormalisedRegistration } from '../registrationQueries'
import type { DisplayName, GetPlayer } from './utils'
import { Button } from '../../../components/ui/Button'
import { ListCard, ListRow } from '../../../components/ui/ListCard'
import { Section } from '../../../components/ui/Section'

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
    <Section
      icon={<Clock className="text-lob-warning-solid" />}
      title={`Waitlist (${waitlisted.length})`}
    >
      <ListCard>
        {waitlisted.map((reg, idx) => {
          const p = getPlayer(reg.playerId)
          if (!p) return null

          return (
            <ListRow key={reg.id}>
              <PlayerRow
                player={p}
                avatarTone="bg-lob-warning-soft text-lob-warning"
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
            </ListRow>
          )
        })}
      </ListCard>
    </Section>
  )
}
