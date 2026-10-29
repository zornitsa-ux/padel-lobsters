import { useState } from 'react'
import type { FeasibilityResult, MatchConfig, ResolvedConfig, ScheduleRun } from '../domain/types'
import type { MatcherPriority } from '../domain/presets'
import ConfigPanel from './ConfigPanel'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import QualityReport from './QualityReport'
import ScheduleRounds from './ScheduleRounds'
import { describeQualityDiff } from './dimensions'
import { ActionRow } from '../../../components/ui/ActionRow'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Button } from '../../../components/ui/Button'
import { FullScreenDialog } from '../../../components/ui/FullScreenDialog'

export type CompareViewProps = {
  open: boolean
  onClose: () => void
  original: ScheduleRun
  altConfig: MatchConfig
  onAltConfigChange: (next: MatchConfig) => void
  altResolvedConfig: ResolvedConfig
  altPresetIntent: string
  altPriorities: MatcherPriority[]
  altFeasibility: FeasibilityResult
  playerCount: number
  onGenerateAlt: () => void
  generatingAlt: boolean
  altRun: ScheduleRun | null
  onUseAlternative: () => void
  // The container's announcements, shown inside the dialog: the page behind it is hidden from
  // assistive tech.
  status: string
  error?: string | null
}

type RoundsTab = 'original' | 'alternative'

const ROUNDS_TABS: { value: RoundsTab; label: string }[] = [
  { value: 'original', label: 'Original rounds' },
  { value: 'alternative', label: 'Alternative rounds' },
]

export default function CompareView({
  open,
  onClose,
  original,
  altConfig,
  onAltConfigChange,
  altResolvedConfig,
  altPresetIntent,
  altPriorities,
  altFeasibility,
  playerCount,
  onGenerateAlt,
  generatingAlt,
  altRun,
  onUseAlternative,
  status,
  error = null,
}: CompareViewProps) {
  const [roundsTab, setRoundsTab] = useState<RoundsTab>('original')

  const diffLines = altRun
    ? describeQualityDiff({
        original: original.quality.overall,
        alternative: altRun.quality.overall,
      })
    : []

  return (
    <FullScreenDialog
      open={open}
      onClose={onClose}
      title="Compare schedules"
      description="Your current schedule stays unless you choose the alternative."
      footer={
        <ActionRow>
          <Button onClick={onClose} variant="secondary">
            Keep original
          </Button>
          <Button onClick={onUseAlternative} disabled={!altRun}>
            Use alternative
          </Button>
        </ActionRow>
      }
    >
      <div className="space-y-4">
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        {error && (
          <div role="alert">
            <AlertBox variant="error">{error}</AlertBox>
          </div>
        )}

        <div className="card space-y-3">
          <p className="font-semibold text-lob-slate text-sm">How they compare</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="label">Current schedule</p>
              <QualityReport
                quality={original.quality}
                violations={original.violations}
                rounds={original.rounds}
                compact
              />
            </div>
            <div className="space-y-2">
              <p className="label">Alternative</p>
              {altRun ? (
                <QualityReport
                  quality={altRun.quality}
                  violations={altRun.violations}
                  rounds={altRun.rounds}
                  compact
                />
              ) : (
                <p className="text-xs text-lob-muted-light">Generate an alternative to compare.</p>
              )}
            </div>
          </div>
          {altRun && diffLines.length > 0 && (
            <div className="space-y-0.5">
              {diffLines.map((line) => (
                <p key={line} className="text-xs text-lob-muted">
                  Alternative: {line}
                </p>
              ))}
            </div>
          )}
        </div>

        <ConfigPanel
          config={altConfig}
          onConfigChange={onAltConfigChange}
          resolvedConfig={altResolvedConfig}
          presetIntent={altPresetIntent}
          priorities={altPriorities}
          feasibility={altFeasibility}
          playerCount={playerCount}
          onGenerate={onGenerateAlt}
          generating={generatingAlt}
          generateIdleLabel={altRun ? 'Regenerate alternative' : 'Generate alternative'}
        />

        <div className="space-y-2">
          <SegmentedControl
            ariaLabel="Rounds"
            options={ROUNDS_TABS}
            value={roundsTab}
            onChange={setRoundsTab}
          />
          <div>
            {roundsTab === 'original' ? (
              <ScheduleRounds rounds={original.rounds} />
            ) : altRun ? (
              <ScheduleRounds rounds={altRun.rounds} />
            ) : (
              <p className="text-xs text-lob-muted-light">
                Generate an alternative above to see its rounds here.
              </p>
            )}
          </div>
        </div>
      </div>
    </FullScreenDialog>
  )
}
