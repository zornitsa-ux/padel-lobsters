import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { SwapSuggestion } from '../domain/swaps'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import { playerName, type PlayerNamesById } from './playerNames'

// Presentational only (M3.8, D-026 "Option A"): a focused, viewport-anchored
// overlay listing the ranked candidates from suggestOpponentSwaps for one repeat
// chip, each described in plain, player-facing language (D-022 — no cost
// numbers, no dimension jargon) with an Apply action. Anchored to the viewport
// (not inline after the rounds) so it is visible wherever the admin clicked Fix
// — the placement lesson from M3.6 Finding 8.

export type RematchFixPanelProps = {
  suggestions: SwapSuggestion[]
  playerNamesById: PlayerNamesById
  // The pair being fixed, for the overlay heading (e.g. "Priya vs Sam").
  targetPair: [string, string]
  onApply: (suggestion: SwapSuggestion) => void
  onCancel: () => void
  applying?: boolean
}

// opponentRepeatDelta: raw.opponentRepeat after − before (swaps.ts docblock).
// Every suggestion already breaks the targeted pair; the delta describes the
// swap's effect on repeats *elsewhere* in the schedule.
function varietyPhrase(delta: number): string {
  if (delta < 0) return 'fewer repeat opponents overall'
  if (delta === 0) return 'no new repeats'
  return 'but adds a repeat elsewhere'
}

// balanceDelta is a weighted cost, already bounded by maxBalanceDelta at the
// domain layer — these cutoffs are presentation-only phrasing, not a filter.
const BALANCE_BARELY_MOVES = 0.35

function balancePhrase(delta: number): string {
  if (delta <= 0) return 'balance improves'
  if (delta <= BALANCE_BARELY_MOVES) return 'balance barely moves'
  return 'balance shifts a bit'
}

export default function RematchFixPanel({
  suggestions,
  playerNamesById,
  targetPair,
  onApply,
  onCancel,
  applying = false,
}: RematchFixPanelProps) {
  useBodyScrollLock(true)
  useEscapeToClose({ active: true, onClose: onCancel })

  const [a, b] = targetPair

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {suggestions.length} fix option{suggestions.length === 1 ? '' : 's'}
      </p>

      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <p className="font-semibold text-gray-700 text-sm">Fix this repeat</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {playerName({ id: a, playerNamesById })} vs {playerName({ id: b, playerNamesById })}{' '}
              are meeting again.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Cancel fix"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4">
          {suggestions.length === 0 ? (
            <p className="text-xs text-gray-500">
              No swap breaks this rematch without unbalancing the court too much.
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((suggestion) => {
                const { move } = suggestion
                const outName = playerName({ id: move.outPlayerId, playerNamesById })
                const inName = playerName({ id: move.inPlayerId, playerNamesById })
                return (
                  <li
                    key={`${move.outPlayerId}-${move.inPlayerId}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="text-sm text-gray-700">
                      Swap <span className="font-semibold">{outName}</span> for{' '}
                      <span className="font-semibold">{inName}</span> —{' '}
                      {varietyPhrase(suggestion.opponentRepeatDelta)},{' '}
                      {balancePhrase(suggestion.balanceDelta)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onApply(suggestion)}
                      disabled={applying}
                      className="btn-primary text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="btn-secondary text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
