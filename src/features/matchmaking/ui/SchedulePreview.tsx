import { Columns2 } from 'lucide-react'
import type { ScheduleRun } from '../domain/types'
import QualityReport from './QualityReport'
import ScheduleRounds, { type SwapHandlers } from './ScheduleRounds'

export type SchedulePreviewProps = {
  run: ScheduleRun // the current preview
  onCompare: () => void // opens the Compare → Alternatives overlay
  onSave: () => void
  saving: boolean
  onUndoSwap?: () => void // present only when a swap can be undone
} & SwapHandlers

function RunLabel({ run }: { run: ScheduleRun }) {
  return (
    <p className="label">
      {run.config.preset} · seed {run.seed}
    </p>
  )
}

export default function SchedulePreview({
  run,
  onCompare,
  onSave,
  saving,
  onUndoSwap,
  ...handlers
}: SchedulePreviewProps) {
  const busy = saving
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <QualityReport quality={run.quality} violations={run.violations} rounds={run.rounds} />
        <RunLabel run={run} />
      </div>

      {onUndoSwap && (
        <button
          type="button"
          onClick={onUndoSwap}
          disabled={busy}
          className="btn-secondary text-sm w-full disabled:opacity-50"
        >
          Undo last swap
        </button>
      )}

      <ScheduleRounds rounds={run.rounds} {...handlers} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCompare}
          disabled={busy}
          className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Columns2 size={16} />
          Compare
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="flex-1 btn-primary text-sm"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
