import React from 'react'
import { Clock, X } from 'lucide-react'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { IconButton } from '../../components/ui/IconButton'
import type { CommunityPlayer } from './playersSelectors'

interface PendingApprovalsListProps {
  pendingPlayers: CommunityPlayer[]
  onApprove: (player: CommunityPlayer) => void
  onReject: (id: string | number) => void
  onLink: (player: CommunityPlayer) => void
}

export default function PendingApprovalsList({
  pendingPlayers,
  onApprove,
  onReject,
  onLink,
}: PendingApprovalsListProps) {
  if (pendingPlayers.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-orange-500" />
        <p className="text-sm font-bold text-orange-600">
          Waiting for approval ({pendingPlayers.length})
        </p>
      </div>
      {pendingPlayers.map((p) => (
        <div key={p.id} className="card border-l-4 border-orange-300 space-y-2">
          <PlayerRow
            player={p}
            avatarSize="lg"
            name={p.name}
            nameClassName="font-semibold text-lob-dark truncate"
            subtitle={
              <>
                Lv {(p.playtomicLevel || 0).toFixed(1)}
                {p.email && ` · ${p.email}`}
              </>
            }
            trailing={
              <IconButton
                onClick={() => onReject(p.id)}
                aria-label={`Reject ${p.name}`}
                variant="destructive"
                size="sm"
                className="flex-shrink-0"
              >
                <X size={13} />
              </IconButton>
            }
          />
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(p)}
              className="flex-1 text-xs bg-green-500 text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all"
            >
              ✓ Approve as new player
            </button>
            <button
              onClick={() => onLink(p)}
              className="flex-1 text-xs bg-lob-teal text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all"
            >
              🔗 Played before?
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
