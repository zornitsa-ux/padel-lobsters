import React from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ScheduleWarning } from './types'
import { AlertBox } from '../../../components/ui/AlertBox'

type Props = {
  warnings: ScheduleWarning[]
  showSuccess: boolean
}

const SECTIONS = [
  { severity: 'error', variant: 'error', title: 'Rule violations' },
  { severity: 'warning', variant: 'warning', title: 'Heads up' },
  { severity: 'info', variant: 'info', title: 'Unavoidable — no action needed' },
] as const

const hasRound = (warning: ScheduleWarning) =>
  warning.severity === 'error' || (warning.severity === 'info' && warning.round > 0)

const warningLine = (warning: ScheduleWarning) =>
  hasRound(warning) ? `R${warning.round}: ${warning.message}` : warning.message

export default function ScheduleValidationSummary({ warnings, showSuccess }: Props) {
  const hasError = warnings.some((warning) => warning.severity === 'error')
  const hasWarning = warnings.some((warning) => warning.severity === 'warning')

  return (
    <>
      {SECTIONS.map(({ severity, variant, title }) => {
        const lines = warnings.filter((warning) => warning.severity === severity)
        if (lines.length === 0) return null
        return (
          <AlertBox key={severity} variant={variant} icon={<AlertCircle />} title={title}>
            <ul className="space-y-0.5">
              {lines.map((warning, index) => (
                <li key={index}>• {warningLine(warning)}</li>
              ))}
            </ul>
          </AlertBox>
        )
      })}

      {!hasError && !hasWarning && showSuccess && (
        <AlertBox variant="success" icon={<CheckCircle2 />}>
          {warnings.length === 0
            ? 'All rules pass — no conflicts detected'
            : 'No rule violations — only unavoidable notes above'}
        </AlertBox>
      )}
    </>
  )
}
