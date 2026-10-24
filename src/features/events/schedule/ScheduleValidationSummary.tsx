import React from 'react'
import { AlertCircle } from 'lucide-react'
import type { ScheduleWarning } from './types'

type Props = {
  warnings: ScheduleWarning[]
  showSuccess: boolean
}

export default function ScheduleValidationSummary({ warnings, showSuccess }: Props) {
  if (warnings.length === 0) {
    if (!showSuccess) return null
    return (
      <div className="bg-lob-success-light border border-lob-success-border rounded-xl p-3 flex items-center gap-2">
        <span className="text-sm">✅</span>
        <p className="text-xs text-lob-success font-medium">
          All rules pass — no conflicts detected
        </p>
      </div>
    )
  }

  const hasError = warnings.some((warning) => warning.severity === 'error')
  const hasWarning = warnings.some((warning) => warning.severity === 'warning')

  return (
    <>
      <div className="rounded-xl border overflow-hidden">
        {hasError && (
          <div className="bg-lob-danger-light border-b border-lob-danger-border p-3 space-y-1">
            <p className="text-xs font-bold text-lob-danger-strong flex items-center gap-1.5">
              <AlertCircle size={14} /> Rule violations
            </p>
            {warnings
              .filter((warning) => warning.severity === 'error')
              .map((warning, index) => (
                <p key={`e${index}`} className="text-xs text-lob-danger">
                  • R{warning.round}: {warning.message}
                </p>
              ))}
          </div>
        )}

        {hasWarning && (
          <div className="bg-lob-warning-light border-b border-lob-warning-border p-3 space-y-1">
            <p className="text-xs font-bold text-lob-warning flex items-center gap-1.5">
              <AlertCircle size={14} /> Heads up
            </p>
            {warnings
              .filter((warning) => warning.severity === 'warning')
              .map((warning, index) => (
                <p key={`w${index}`} className="text-xs text-lob-warning">
                  • {warning.message}
                </p>
              ))}
          </div>
        )}

        {warnings.some((warning) => warning.severity === 'info') && (
          <div className="bg-lob-info-light p-3 space-y-1">
            <p className="text-xs font-bold text-lob-info flex items-center gap-1.5">
              <AlertCircle size={14} /> Unavoidable — no action needed
            </p>
            {warnings
              .filter((warning) => warning.severity === 'info')
              .map((warning, index) => (
                <p key={`i${index}`} className="text-xs text-lob-info">
                  • {warning.round > 0 ? `R${warning.round}: ` : ''}
                  {warning.message}
                </p>
              ))}
          </div>
        )}
      </div>

      {!hasError && !hasWarning && showSuccess && (
        <div className="bg-lob-success-light border border-lob-success-border rounded-xl p-3 flex items-center gap-2">
          <span className="text-sm">✅</span>
          <p className="text-xs text-lob-success font-medium">
            No rule violations — only unavoidable notes above
          </p>
        </div>
      )}
    </>
  )
}
