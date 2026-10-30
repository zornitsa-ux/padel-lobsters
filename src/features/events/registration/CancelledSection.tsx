import { UserX } from 'lucide-react'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import type { NormalisedRegistration } from '../registrationQueries'
import type { DisplayName, GetPlayer } from './utils'
import { ListCard, ListRow } from '../../../components/ui/ListCard'
import { Section } from '../../../components/ui/Section'
import { TextButton } from '../../../components/ui/TextButton'

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
    <Section
      icon={<UserX />}
      title={`Cancelled (${cancelled.length})`}
      action={
        <TextButton hitArea aria-expanded={expanded} onClick={onToggle}>
          {expanded ? 'Hide' : 'Show'}
        </TextButton>
      }
    >
      {expanded && (
        <ListCard>
          {cancelled.map((reg) => {
            const p = getPlayer(reg.playerId)
            if (!p) return null

            return (
              <ListRow key={reg.id}>
                <PlayerRow
                  player={p}
                  avatarTone="bg-lob-teal-light text-lob-muted"
                  name={displayName(p)}
                  nameClassName="text-sm text-lob-muted line-through"
                />
              </ListRow>
            )
          })}
        </ListCard>
      )}
    </Section>
  )
}
