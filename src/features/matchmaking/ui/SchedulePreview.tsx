import { Columns2 } from 'lucide-react'
import type { ScheduleRun } from '../domain/types'
import QualityReport from './QualityReport'
import ScheduleRounds, { type SwapHandlers } from './ScheduleRounds'
import { ActionRow } from '../../../components/ui/ActionRow'
import { Button } from '../../../components/ui/Button'

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
        <Button onClick={onUndoSwap} disabled={busy} variant="secondary" fullWidth>
          Undo last swap
        </Button>
      )}

      <ScheduleRounds rounds={run.rounds} {...handlers} />

      <ActionRow>
        <Button onClick={onCompare} disabled={busy} variant="secondary" icon={<Columns2 />}>
          Compare
        </Button>
        <Button onClick={onSave} disabled={busy}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ActionRow>
    </div>
  )
}
