import { ChevronLeft, X } from 'lucide-react'
import { IconButton } from './IconButton'
import { ProgressBar } from './ProgressBar'
import { TextButton } from './TextButton'

interface StepHeaderProps {
  /** 1-based. */
  step: number
  total: number
  onBack: () => void
  onClose: () => void
  /** Names the close button, e.g. "Stop setting your level". */
  closeLabel: string
}

/**
 * The top of a one-question-per-screen flow: Back, "2 of 6", close, and a progress bar
 * that fills as steps are done.
 */
export function StepHeader({ step, total, onBack, onClose, closeLabel }: StepHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <span>
          <TextButton
            tone="neutral"
            size="sm"
            icon={<ChevronLeft size={14} aria-hidden="true" />}
            onClick={onBack}
            hitArea
          >
            Back
          </TextButton>
        </span>
        <p className="caption font-semibold uppercase tracking-wide" aria-live="polite">
          {step} of {total}
        </p>
        <span className="flex justify-end">
          <IconButton variant="ghost" size="sm" aria-label={closeLabel} onClick={onClose}>
            <X />
          </IconButton>
        </span>
      </div>
      <ProgressBar value={(step / total) * 100} size="xs" />
    </div>
  )
}
