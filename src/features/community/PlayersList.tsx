import { User } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { FlagImg } from '../../components/ui/CountryPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkCard } from '../../components/ui/LinkCard'
import { Badge } from '../../components/ui/Badge'
import { levelBadgeClass } from './playerConstants'
import type { CommunityPlayer, OrderedPlayer } from './playersSelectors'

interface PlayersListProps {
  orderedForRender: OrderedPlayer<CommunityPlayer>[]
  displayName: (player: CommunityPlayer) => string
  emptyTitle?: string
}

function PlayerName({
  player,
  name,
  isSelf,
}: {
  player: CommunityPlayer
  name: string
  isSelf: boolean
}) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {player.country && <FlagImg code={player.country} />}
      <span className="truncate">{name}</span>
      {player.isLeftHanded && <Badge tone="warning" label="L" title="Left-handed" />}
      {isSelf && <Badge tone="brand" label="You" />}
    </span>
  )
}

export default function PlayersList({
  orderedForRender,
  displayName,
  emptyTitle = 'No players yet. Be the first to join!',
}: PlayersListProps) {
  if (orderedForRender.length === 0) {
    return <EmptyState icon={<User />} title={emptyTitle} />
  }
  return (
    <div className="space-y-2">
      {orderedForRender.map(({ p, isSelf }) => {
        const level = p.playtomicLevel || 0
        return (
          <LinkCard
            key={p.id}
            to={`/community/${p.id}`}
            className={isSelf ? 'ring-2 ring-lob-teal/40' : undefined}
            leading={<Avatar player={p} size="md" />}
            title={<PlayerName player={p} name={displayName(p)} isSelf={isSelf} />}
            trailing={
              <span
                className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadgeClass(level)}`}
              >
                {level.toFixed(1)}
              </span>
            }
          />
        )
      })}
    </div>
  )
}
