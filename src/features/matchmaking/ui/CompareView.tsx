import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { FeasibilityResult, MatchConfig, ResolvedConfig, ScheduleRun } from '../domain/types'
import type { MatcherPriority } from '../domain/presets'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import ConfigPanel from './ConfigPanel'
import { segmentedButtonClass } from './segmentedButton'
import QualityReport from './QualityReport'
import ScheduleRounds from './ScheduleRounds'
import { describeQualityDiff } from './dimensions'

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
  const [roundsTab, setRoundsTab] = useState<'original' | 'alternative'>('original')

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
        <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-lob-slate text-base">Compare schedules</p>
            <p className="text-xs text-lob-muted mt-0.5">
              Your current schedule stays unless you choose the alternative.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lob-muted-light hover:text-lob-slate flex-shrink-0"
            aria-label="Close compare"
          >
            <X size={20} />
          </button>
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
                  compact
                />
              </div>
              <div className="space-y-2">
                <p className="label">Alternative</p>
                {altRun ? (
                  <QualityReport quality={altRun.quality} violations={altRun.violations} compact />
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
            <div className="flex gap-2" role="tablist" aria-label="Rounds">
              {(['original', 'alternative'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={roundsTab === tab}
                  onClick={() => setRoundsTab(tab)}
                  className={`${segmentedButtonClass(roundsTab === tab)} capitalize`}
                >
                  {tab} rounds
                </button>
              ))}
            </div>
            <div role="tabpanel">
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

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 btn-secondary text-sm">
            Keep original
          </button>
          <button
            type="button"
            onClick={onUseAlternative}
            disabled={!altRun}
            className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use alternative
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
