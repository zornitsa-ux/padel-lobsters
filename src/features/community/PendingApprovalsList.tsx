import React from 'react'
import { Clock, X, Mail, RotateCcw } from 'lucide-react'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { IconButton } from '../../components/ui/IconButton'
import { ActionChip } from '../../components/ui/ActionChip'
import { Skeleton } from '../../components/ui/Skeleton'
import { useRevealPii } from './useRevealPii'
import type { CommunityPlayer } from './playersSelectors'

// Per-row, on-demand email reveal. Approve/Reject need no PII at all;
// only "Played before?" (identity disambiguation) does, and that flow
// fetches its own PII independently — so nothing here fetches until the
// admin explicitly asks to see THIS row's email.
function PendingEmailReveal({ playerId }: { playerId: string }) {
  const { revealed, reveal, pii, isLoading, isError, retry } = useRevealPii(playerId)

  if (!revealed) {
    return (
      <ActionChip icon={<Mail size={10} />} onClick={reveal}>
        Show email
      </ActionChip>
    )
  }
  if (isLoading) {
    return (
      <span role="status" aria-live="polite">
        <span className="sr-only">Loading email…</span>
        <Skeleton className="h-3 w-32 inline-block align-middle" />
      </span>
    )
  }
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 text-lob-amber">
        couldn't load
        <IconButton aria-label="Retry loading email" size="sm" onClick={() => retry()}>
          <RotateCcw size={10} />
        </IconButton>
      </span>
    )
  }
  return <>{pii?.email || 'no email on file'}</>
}

interface PendingApprovalsListProps {
  pendingPlayers: CommunityPlayer[]
  onApprove: (player: CommunityPlayer) => void
  onReject: (id: string) => void
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
              <span className="inline-flex items-center gap-1">
                Lv {(p.playtomicLevel || 0).toFixed(1)} ·{' '}
                <PendingEmailReveal playerId={String(p.id)} />
              </span>
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
