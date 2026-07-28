import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { QualityDimensions, Violation } from '../domain/types'
import { DIMENSIONS } from './dimensions'
import { ProgressBar } from '../../../components/ui/ProgressBar'

export type QualityReportProps = {
  quality: { overall: QualityDimensions; perRound: QualityDimensions[] }
  violations: Violation[]
  // compact = grade + 5 bars only (no disclosure); used in the compare view.
  compact?: boolean
}

function gradeBand(pct: number): { label: string; textClass: string; bgClass: string } {
  if (pct >= 90) return { label: 'Excellent', textClass: 'text-green-700', bgClass: 'bg-green-50' }
  if (pct >= 80) return { label: 'Good', textClass: 'text-lob-teal', bgClass: 'bg-lob-teal/10' }
  if (pct >= 70) return { label: 'Fair', textClass: 'text-amber-700', bgClass: 'bg-amber-50' }
  return { label: 'Needs work', textClass: 'text-red-700', bgClass: 'bg-red-50' }
}

function meanOverall(overall: QualityDimensions): number {
  const sum = DIMENSIONS.reduce((total, { key }) => total + overall[key], 0)
  return Math.round(sum / DIMENSIONS.length)
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-600 mb-0.5">
        <span className="label mb-0">{label}</span>
        <span className="font-medium text-gray-700">{Math.round(value)}%</span>
      </div>
      <ProgressBar value={value} fillClassName="bg-lob-teal/70" />
    </div>
  )
}

function violationLabel(violation: Violation): string {
  const courtSegment = violation.court !== null ? ` · Court ${violation.court}` : ''
  return `Round ${violation.round}${courtSegment} · ${violation.rule}: ${violation.reason}`
}

export default function QualityReport({
  quality,
  violations,
  compact = false,
}: QualityReportProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const overallPct = meanOverall(quality.overall)
  const band = gradeBand(overallPct)

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

      <div className="space-y-2">
        {DIMENSIONS.map(({ key, label }) => (
          <DimensionBar key={key} label={label} value={quality.overall[key]} />
        ))}
      </div>

      {!compact && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex items-center gap-1 text-sm font-semibold text-lob-teal"
          >
            {detailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Details
          </button>

          {detailsOpen && (
            <div className="space-y-4 pl-1">
              <div>
                <p className="label">Per round</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
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
                        <tr key={index} className="border-t border-gray-100">
                          <td className="py-1 pr-2 text-gray-700 font-medium">Round {index + 1}</td>
                          {DIMENSIONS.map(({ key }) => (
                            <td key={key} className="py-1 pl-2 text-right text-gray-600">
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
                  <p className="text-xs text-gray-500">No rule violations.</p>
                ) : (
                  <ul className="space-y-1">
                    {violations.map((violation, index) => (
                      <li
                        key={index}
                        className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1"
                      >
                        {violationLabel(violation)}
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
