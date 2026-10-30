import { X } from 'lucide-react'
import { IconButton } from './IconButton'

type Variant = 'info' | 'warning' | 'success' | 'error'
/** `md` (default) for page and section notices; `sm` for notices inside a card, row or form. */
type Size = 'sm' | 'md'

interface AlertBoxProps {
  variant: Variant
  size?: Size
  /** Sized by the box; colour comes from the variant. */
  icon?: React.ReactNode
  /** Bold first line, in the variant's strong shade. */
  title?: React.ReactNode
  children?: React.ReactNode
  /** One inline action (a `TextButton`) on the trailing edge, beside the text. */
  action?: React.ReactNode
  /** Buttons under the text (`ActionRow`, a full-width `Button`). */
  actions?: React.ReactNode
  /** Renders a dismiss button on the trailing edge when provided. */
  onDismiss?: () => void
}

const VARIANT: Record<Variant, { box: string; title: string }> = {
  info: {
    box: 'bg-lob-info-light border-lob-info-border text-lob-info',
    title: 'text-lob-info-strong',
  },
  warning: {
    box: 'bg-lob-warning-light border-lob-warning-border text-lob-warning',
    title: 'text-lob-warning-strong',
  },
  success: {
    box: 'bg-lob-success-light border-lob-success-border text-lob-success',
    title: 'text-lob-success-strong',
  },
  error: {
    box: 'bg-lob-danger-light border-lob-danger-border text-lob-danger',
    title: 'text-lob-danger-strong',
  },
}

// The dismiss margins pull the 32px tap target back to one line of text.
const SIZE: Record<Size, { box: string; icon: string; dismiss: string }> = {
  md: { box: 'rounded-xl p-3 gap-2 text-sm', icon: '[&>svg]:size-3.5', dismiss: '-my-1.5 -mr-1.5' },
  sm: {
    box: 'rounded-lg px-2.5 py-2 gap-1.5 text-xs',
    icon: '[&>svg]:size-3',
    dismiss: '-my-2 -mr-1.5',
  },
}

// `0 && …` renders "0", so a plain truthiness check isn't enough.
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== ''

export function AlertBox({
  variant,
  size = 'md',
  icon,
  title,
  children,
  action,
  actions,
  onDismiss,
}: AlertBoxProps) {
  const sizing = SIZE[size]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start border ${sizing.box} ${VARIANT[variant].box}`}
    >
      {icon && <div className={`flex-shrink-0 mt-0.5 ${sizing.icon}`}>{icon}</div>}
      <div className="flex-1 min-w-0 leading-snug">
        {hasContent(title) && <p className={`font-semibold ${VARIANT[variant].title}`}>{title}</p>}
        {hasContent(children) && (
          <div className={hasContent(title) ? 'mt-0.5' : undefined}>{children}</div>
        )}
        {hasContent(actions) && <div className="mt-3">{actions}</div>}
      </div>
      {hasContent(action) && <div className="flex-shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={sizing.dismiss}
        >
          <X />
        </IconButton>
      )}
    </div>
  )
}
