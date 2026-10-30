import { User } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { FlagImg } from '../../components/ui/CountryPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkRow, ListCard } from '../../components/ui/ListCard'
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
      {isSelf && <Badge tone="outline" label="You" />}
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
    <ListCard>
      {orderedForRender.map(({ p, isSelf }) => {
        const level = p.playtomicLevel || 0
        return (
          <LinkRow
            key={p.id}
            to={`/community/${p.id}`}
            highlighted={isSelf}
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
    </ListCard>
  )
}
