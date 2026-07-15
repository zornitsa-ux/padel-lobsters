import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { RatingEventRow } from '../matchmakingSchemas'

export type RatingReviewProps = {
  // Count of adjustments auto-applied without review (small, within-cap moves).
  appliedCount: number
  // Flagged events awaiting review (clamped/large moves). Empty = nothing to review.
  queue: RatingEventRow[]
  // Display names for player_id and for partnerId/opponentIds inside breakdowns.
  playerNamesById: Record<string, string>
  onReview: (args: {
    eventId: string
    action: 'approve' | 'edit' | 'discard'
    delta?: number
  }) => void
  // A review mutation is in flight (disable buttons).
  reviewing: boolean
}

function nameFor({
  id,
  playerNamesById,
}: {
  id: string
  playerNamesById: Record<string, string>
}): string {
  return playerNamesById[id] ?? id
}

function formatSigned({ value, digits = 2 }: { value: number; digits?: number }): string {
  const rounded = value.toFixed(digits)
  return value >= 0 ? `+${rounded}` : rounded
}

function BreakdownRow({
  row,
  playerNamesById,
}: {
  row: RatingEventRow['breakdown'][number]
  playerNamesById: Record<string, string>
}) {
  const partnerName = nameFor({ id: row.partnerId, playerNamesById })
  const opponentNames = row.opponentIds
    .map((id) => nameFor({ id, playerNamesById }))
    .join(' & ')

  return (
    <li className="text-xs text-gray-600 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <span>
          Round {row.round} · with {partnerName} vs {opponentNames}
        </span>
        <span className="font-medium text-gray-700">{formatSigned({ value: row.delta })}</span>
      </div>
      <div className="text-gray-400">
        Expected {(row.expectedShare * 100).toFixed(0)}% · Actual{' '}
        {(row.actualShare * 100).toFixed(0)}%
      </div>
    </li>
  )
}

function QueueCard({
  row,
  playerNamesById,
  onReview,
  reviewing,
}: {
  row: RatingEventRow
  playerNamesById: Record<string, string>
  onReview: RatingReviewProps['onReview']
  reviewing: boolean
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('0')

  const playerName = nameFor({ id: row.player_id, playerNamesById })
  const proposedLevel = row.prior_mu + row.proposed_delta
  const remainder = row.proposed_delta - row.applied_delta

  const confirmEdit = () => {
    const delta = Number(editValue)
    if (Number.isNaN(delta)) return
    onReview({ eventId: row.id, action: 'edit', delta })
  }

  return (
    <div className="card space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-700 text-sm">{playerName}</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
            Flagged
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {row.prior_mu.toFixed(2)} → {proposedLevel.toFixed(2)} ·{' '}
          {formatSigned({ value: remainder })} held for review
        </p>
      </div>

      {row.breakdown.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setBreakdownOpen((open) => !open)}
            className="flex items-center gap-1 text-sm font-semibold text-lob-teal"
          >
            {breakdownOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Per-match breakdown
          </button>
          {breakdownOpen && (
            <ul className="mt-2 space-y-2">
              {row.breakdown.map((breakdownRow) => (
                <BreakdownRow
                  key={breakdownRow.matchId}
                  row={breakdownRow}
                  playerNamesById={playerNamesById}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onReview({ eventId: row.id, action: 'approve' })}
          disabled={reviewing}
          className="btn-primary"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          disabled={reviewing}
          className="text-sm font-semibold text-lob-teal disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onReview({ eventId: row.id, action: 'discard' })}
          disabled={reviewing}
          className="text-sm font-semibold text-gray-500 disabled:opacity-50"
        >
          Discard
        </button>
      </div>

      {editing && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step={0.05}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            className="input w-24 text-sm"
          />
          <button
            type="button"
            onClick={confirmEdit}
            disabled={reviewing}
            className="btn-primary"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  )
}

export default function RatingReview({
  appliedCount,
  queue,
  playerNamesById,
  onReview,
  reviewing,
}: RatingReviewProps) {
  return (
    <div className="space-y-3">
      {appliedCount > 0 && (
        <p className="text-sm text-gray-600">
          {appliedCount} adjustment{appliedCount === 1 ? '' : 's'} auto-applied.
        </p>
      )}

      {queue.length === 0 && (
        <div className="card flex items-center gap-2 text-sm text-green-700 bg-green-50">
          <CheckCircle2 size={18} />
          All adjustments auto-applied — nothing to review.
        </div>
      )}

      {queue.map((row) => (
        <QueueCard
          key={row.id}
          row={row}
          playerNamesById={playerNamesById}
          onReview={onReview}
          reviewing={reviewing}
        />
      ))}
    </div>
  )
}
