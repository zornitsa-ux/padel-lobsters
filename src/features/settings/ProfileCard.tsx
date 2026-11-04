import { Pencil, Shield } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { FlagImg } from '../../components/ui/CountryPicker'
import { LevelBadge } from '../../components/ui/LevelBadge'
import { Badge } from '../../components/ui/Badge'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import type { Player } from '../../lib/normalise'

interface ProfileCardProps {
  player: Player
  isAdmin: boolean
  onEdit: () => void
}

/** Who is signed in: photo, name, level and war cry, with the way to edit or view the profile. */
export default function ProfileCard({ player, isAdmin, onEdit }: ProfileCardProps) {
  const level = parseFloat(String(player.playtomicLevel)) || 0
  return (
    <section aria-label="My Lobster Profile" className="card space-y-4">
      <div className="flex items-center gap-3">
        <Avatar player={player} size="xl" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-lob-dark flex items-center gap-1.5">
            {player.country && <FlagImg code={player.country} />}
            <span className="truncate">{player.name}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <LevelBadge level={level} size="sm" />
            {isAdmin && <Badge tone="brand" icon={<Shield />} label="Admin" />}
          </div>
          {player.tagline && (
            <p className="text-xs text-lob-muted italic truncate">“{player.tagline}”</p>
          )}
        </div>
      </div>
      <ActionRow>
        <Button variant="secondary" size="sm" icon={<Pencil />} onClick={onEdit}>
          Edit profile
        </Button>
        <Button variant="neutral" size="sm" to={`/community/${player.id}`}>
          View profile
        </Button>
      </ActionRow>
    </section>
  )
}
