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
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
        <span className="text-sm">✅</span>
        <p className="text-xs text-green-700 font-medium">All rules pass — no conflicts detected</p>
      </div>
    )
  }

  const hasError = warnings.some((warning) => warning.severity === 'error')
  const hasWarning = warnings.some((warning) => warning.severity === 'warning')

  return (
    <>
      <div className="rounded-xl border overflow-hidden">
        {hasError && (
          <div className="bg-red-50 border-b border-red-200 p-3 space-y-1">
            <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
              <AlertCircle size={14} /> Rule violations
            </p>
            {warnings
              .filter((warning) => warning.severity === 'error')
              .map((warning, index) => (
                <p key={`e${index}`} className="text-xs text-red-600">
                  • R{warning.round}: {warning.message}
                </p>
              ))}
          </div>
        )}

        {hasWarning && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-1">
            <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
              <AlertCircle size={14} /> Heads up
            </p>
            {warnings
              .filter((warning) => warning.severity === 'warning')
              .map((warning, index) => (
                <p key={`w${index}`} className="text-xs text-amber-600">
                  • {warning.message}
                </p>
              ))}
          </div>
        )}

        {warnings.some((warning) => warning.severity === 'info') && (
          <div className="bg-blue-50 p-3 space-y-1">
            <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <AlertCircle size={14} /> Unavoidable — no action needed
            </p>
            {warnings
              .filter((warning) => warning.severity === 'info')
              .map((warning, index) => (
                <p key={`i${index}`} className="text-xs text-blue-600">
                  • {warning.round > 0 ? `R${warning.round}: ` : ''}
                  {warning.message}
                </p>
              ))}
          </div>
        )}
      </div>

      {!hasError && !hasWarning && showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-sm">✅</span>
          <p className="text-xs text-green-700 font-medium">
            No rule violations — only unavoidable notes above
          </p>
        </div>
      )}
    </>
  )
}
