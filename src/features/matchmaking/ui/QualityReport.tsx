import { useState } from 'react'
import type { QualityDimensions, ScheduleRun, Violation } from '../domain/types'
import { playerNamesById, violationLine, violationsSummary } from './violationCopy'
import { DIMENSIONS } from './dimensions'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { Disclosure } from '../../../components/ui/Disclosure'

export type QualityReportProps = {
  quality: { overall: QualityDimensions; perRound: QualityDimensions[] }
  violations: Violation[]
  // compact = grade + 5 bars only (no disclosure); used in the compare view.
  compact?: boolean
  // Supplies player names so violations read in padel terms; without it the summary is hidden.
  rounds?: ScheduleRun['rounds']
}

function gradeBand(pct: number): { label: string; textClass: string; bgClass: string } {
  if (pct >= 90)
    return { label: 'Excellent', textClass: 'text-lob-success', bgClass: 'bg-lob-success-light' }
  if (pct >= 80) return { label: 'Good', textClass: 'text-lob-teal', bgClass: 'bg-lob-teal/10' }
  if (pct >= 70)
    return { label: 'Fair', textClass: 'text-lob-warning', bgClass: 'bg-lob-warning-light' }
  return {
    label: 'Needs work',
    textClass: 'text-lob-danger-strong',
    bgClass: 'bg-lob-danger-light',
  }
}

function meanOverall(overall: QualityDimensions): number {
  const sum = DIMENSIONS.reduce((total, { key }) => total + overall[key], 0)
  return Math.round(sum / DIMENSIONS.length)
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-lob-slate mb-0.5">
        <span className="label mb-0">{label}</span>
        <span className="font-medium text-lob-slate">{Math.round(value)}%</span>
      </div>
      <ProgressBar value={value} fillClassName="bg-lob-teal/70" />
    </div>
  )
}

function ViolationsBanner({ summary }: { summary: string | null }) {
  if (!summary) return null
  return (
    <p
      role="alert"
      className="text-xs text-lob-danger-strong bg-lob-danger-light rounded-lg px-2 py-1.5"
    >
      {summary}
    </p>
  )
}

export default function QualityReport({
  quality,
  violations,
  compact = false,
  rounds,
}: QualityReportProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const overallPct = meanOverall(quality.overall)
  const band = gradeBand(overallPct)
  const names = rounds ? playerNamesById({ rounds }) : null
  const summary = names ? violationsSummary({ violations, names }) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold ${band.textClass}`}>{overallPct}%</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${band.bgClass} ${band.textClass}`}
        >
          {band.label}
        </span>
      </div>

      <ViolationsBanner summary={summary} />

      <div className="space-y-2">
        {DIMENSIONS.map(({ key, label }) => (
          <DimensionBar key={key} label={label} value={quality.overall[key]} />
        ))}
      </div>

      {!compact && (
        <div className="space-y-2">
          <Disclosure expanded={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)}>
            Details
          </Disclosure>

          {detailsOpen && (
            <div className="space-y-4 pl-1">
              <div>
                <p className="label">Per round</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-lob-muted">
                        <th className="text-left font-medium py-1 pr-2">Round</th>
                        {DIMENSIONS.map(({ key, short, label }) => (
                          <th key={key} className="text-right font-medium py-1 pl-2" title={label}>
                            {short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quality.perRound.map((round, index) => (
                        <tr key={index} className="border-t border-lob-line">
                          <td className="py-1 pr-2 text-lob-slate font-medium">
                            Round {index + 1}
                          </td>
                          {DIMENSIONS.map(({ key }) => (
                            <td key={key} className="py-1 pl-2 text-right text-lob-slate">
                              {Math.round(round[key])}%
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="label">Violations</p>
                {violations.length === 0 ? (
                  <p className="text-xs text-lob-muted">No rule violations.</p>
                ) : (
                  <ul className="space-y-1">
                    {violations.map((violation, index) => (
                      <li
                        key={index}
                        className="text-xs text-lob-warning bg-lob-warning-light rounded-lg px-2 py-1"
                      >
                        {violationLine({ violation, names: names ?? {} })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
