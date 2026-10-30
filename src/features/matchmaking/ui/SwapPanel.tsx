import type { SwapSuggestion, SwapTarget } from '../domain/swaps'
import type { ScheduleRun } from '../domain/types'
import type { PlayerNamesById } from './playerNames'
import { emptyCopy, panelHeading, swapRowCopy } from './swapCopy'
import { Button } from '../../../components/ui/Button'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Modal } from '../../../components/ui/Modal'
import { TextButton } from '../../../components/ui/TextButton'

// Presentational only (D-026 "Option A", generalized in D-036): a sheet listing
// ranked swaps for one target (a repeat, an uneven court, or a tapped player),
// each in plain player-facing language (D-022 — no cost numbers, no dimension
// jargon) with an Apply action. A sheet rather than inline, so it is visible
// wherever the admin tapped (M3.6 Finding 8).

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
  // Shown inside the sheet, since the page behind it is hidden from assistive tech.
  error?: string | null
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
      <Button onClick={() => onApply(suggestion)} disabled={applying} size="sm">
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
  error = null,
}: SwapPanelProps) {
  const heading = panelHeading({ target, names: playerNamesById })

  return (
    <Modal
      open
      onClose={onCancel}
      // A swap query in flight would reopen the sheet once it lands.
      dismissible={!applying}
      title={heading.title}
      description={heading.detail}
      footer={
        <Button onClick={onCancel} disabled={applying} variant="secondary" fullWidth>
          Cancel
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="sr-only" role="status" aria-live="polite">
          {suggestions.length} swap option{suggestions.length === 1 ? '' : 's'}
        </p>
        {error && <AlertBox variant="error">{error}</AlertBox>}
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
          <TextButton tone="neutral" onClick={onShowAll} disabled={applying}>
            Show all swaps
          </TextButton>
        )}
      </div>
    </Modal>
  )
}
