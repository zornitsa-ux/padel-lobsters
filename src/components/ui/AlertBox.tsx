import { X } from 'lucide-react'

interface AlertBoxProps {
  variant: 'info' | 'warning' | 'success' | 'error'
  icon?: React.ReactNode
  children: React.ReactNode
  /** Renders a dismiss button on the trailing edge when provided. */
  onDismiss?: () => void
  className?: string
}

const variantClasses: Record<AlertBoxProps['variant'], string> = {
  info: 'bg-lob-info-light border-lob-info-border text-lob-info',
  warning: 'bg-lob-warning-light border-lob-warning-border text-lob-warning',
  success: 'bg-lob-success-light border-lob-success-border text-lob-success',
  error: 'bg-lob-danger-light border-lob-danger-border text-lob-danger',
}

export function AlertBox({ variant, icon, children, onDismiss, className }: AlertBoxProps) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${variantClasses[variant]} ${className ?? ''}`}
    >
      {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
      <div className="flex-1 leading-snug">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 mt-0.5 opacity-60 hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
