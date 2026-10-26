import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { FeasibilityResult, MatchConfig, ResolvedConfig, ScheduleRun } from '../domain/types'
import type { MatcherPriority } from '../domain/presets'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import ConfigPanel from './ConfigPanel'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import QualityReport from './QualityReport'
import ScheduleRounds from './ScheduleRounds'
import { describeQualityDiff } from './dimensions'
import { ActionRow } from '../../../components/ui/ActionRow'
import { Button } from '../../../components/ui/Button'
import { IconButton } from '../../../components/ui/IconButton'

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
}: CompareViewProps) {
  const [roundsTab, setRoundsTab] = useState<RoundsTab>('original')

  useBodyScrollLock(open)
  useEscapeToClose({ active: open, onClose })

  if (!open) return null

  const diffLines = altRun
    ? describeQualityDiff({
        original: original.quality.overall,
        alternative: altRun.quality.overall,
      })
    : []

  // Portal to <body>: the overlay is mounted deep in the Schedule tree, where a
  // transformed/scroll-container ancestor would otherwise make `fixed` relative
  // to that ancestor (leaving a gap at the top and the page scrollable behind).
  return createPortal(
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <p className="sr-only" role="status" aria-live="polite">
        {altRun ? 'Alternative generated' : ''}
      </p>

      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-lob-line flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-lob-slate text-base">Compare schedules</p>
            <p className="text-xs text-lob-muted mt-0.5">
              Your current schedule stays unless you choose the alternative.
            </p>
          </div>
          <IconButton onClick={onClose} aria-label="Close compare" variant="ghost">
            <X />
          </IconButton>
        </div>

        <div className="px-4 py-4 space-y-4">
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
                  <p className="text-xs text-lob-muted-light">
                    Generate an alternative to compare.
                  </p>
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

        <div className="sticky bottom-0 bg-white border-t border-lob-line px-4 py-3">
          <ActionRow>
            <Button onClick={onClose} variant="secondary">
              Keep original
            </Button>
            <Button onClick={onUseAlternative} disabled={!altRun}>
              Use alternative
            </Button>
          </ActionRow>
        </div>
      </div>
    </div>,
    document.body,
  )
}
