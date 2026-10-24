import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { SwapSuggestion, SwapTarget } from '../domain/swaps'
import type { ScheduleRun } from '../domain/types'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import type { PlayerNamesById } from './playerNames'
import { emptyCopy, panelHeading, swapRowCopy } from './swapCopy'
import { Button } from '../../../components/ui/Button'

// Presentational only (D-026 "Option A", generalized in D-036): a focused,
// viewport-anchored overlay listing ranked swaps for one target (a repeat, an
// uneven court, or a tapped player), each in plain player-facing language
// (D-022 — no cost numbers, no dimension jargon) with an Apply action.
// Viewport-anchored so it is visible wherever the admin tapped (M3.6 Finding 8).

export type SwapPanelProps = {
  target: SwapTarget
  suggestions: SwapSuggestion[]
  // The run the suggestions were computed against; row copy diffs against it.
  currentRun: ScheduleRun
  playerNamesById: PlayerNamesById
  showingAll: boolean
  onShowAll: () => void
  onApply: (suggestion: SwapSuggestion) => void
  onCancel: () => void
  applying?: boolean
}

function SwapRow({
  suggestion,
  currentRun,
  target,
  playerNamesById,
  onApply,
  applying,
}: Pick<SwapPanelProps, 'currentRun' | 'target' | 'playerNamesById' | 'onApply'> & {
  suggestion: SwapSuggestion
  applying: boolean
}) {
  const copy = swapRowCopy({ suggestion, before: currentRun, target, names: playerNamesById })
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-sm text-lob-slate">
          Swap <span className="font-semibold">{copy.outName}</span> for{' '}
          <span className="font-semibold">{copy.inName}</span> — {copy.effects}
        </p>
        {copy.missesTarget && <p className="text-xs text-lob-muted">{copy.missesTarget}</p>}
        {copy.ruleBreaks.map((line) => (
          <p key={line} className="text-xs font-semibold text-lob-danger">
            {line}
          </p>
        ))}
      </div>
      <Button
        onClick={() => onApply(suggestion)}
        disabled={applying}
        size="sm"
        className="flex-shrink-0"
      >
        Apply
      </Button>
    </li>
  )
}

export default function SwapPanel({
  target,
  suggestions,
  currentRun,
  playerNamesById,
  showingAll,
  onShowAll,
  onApply,
  onCancel,
  applying = false,
}: SwapPanelProps) {
  useBodyScrollLock(true)
  useEscapeToClose({ active: true, onClose: onCancel })

  const heading = panelHeading({ target, names: playerNamesById })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {suggestions.length} swap option{suggestions.length === 1 ? '' : 's'}
      </p>

      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-4 py-3 border-b border-lob-line flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <p className="font-semibold text-lob-slate text-sm">{heading.title}</p>
            <p className="text-xs text-lob-muted mt-0.5">{heading.detail}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-lob-muted-light hover:text-lob-slate flex-shrink-0"
            aria-label="Close swap options"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-xs text-lob-muted">{emptyCopy({ target, showAll: showingAll })}</p>
          ) : (
            <ul className="space-y-3">
              {suggestions.map((suggestion) => (
                <SwapRow
                  key={`${suggestion.move.outPlayerId}-${suggestion.move.inPlayerId}`}
                  suggestion={suggestion}
                  currentRun={currentRun}
                  target={target}
                  playerNamesById={playerNamesById}
                  onApply={onApply}
                  applying={applying}
                />
              ))}
            </ul>
          )}
          {showingAll ? (
            <p className="text-xs text-lob-muted">
              Showing every swap, including ones that break a rule.
            </p>
          ) : (
            <button
              type="button"
              onClick={onShowAll}
              disabled={applying}
              className="text-xs underline decoration-dotted underline-offset-2 text-lob-muted hover:text-lob-slate disabled:opacity-50"
            >
              Show all swaps
            </button>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-lob-line px-4 py-3 rounded-b-2xl">
          <Button
            onClick={onCancel}
            disabled={applying}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
