export const BADGE_TONES = [
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'brand',
  'outline',
  'accent',
] as const

export type BadgeTone = (typeof BADGE_TONES)[number]

export interface BadgeProps {
  tone: BadgeTone
  label: string
  icon?: React.ReactNode
  title?: string
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-lob-success-soft text-lob-success',
  warning: 'bg-lob-warning-soft text-lob-warning',
  danger: 'bg-lob-danger-soft text-lob-danger',
  info: 'bg-lob-info-soft text-lob-info',
  neutral: 'bg-lob-line text-lob-slate',
  brand: 'bg-lob-teal-light text-lob-teal',
  outline: 'bg-white text-lob-slate ring-1 ring-inset ring-lob-line-strong',
  accent: 'bg-lob-amber/15 text-lob-amber',
}

// Shrinks under pressure and truncates the label rather than overflowing a
// narrow row; the icon keeps its size.
export function Badge({ tone, label, icon, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold [&>svg]:size-3 [&>svg]:shrink-0 ${toneClasses[tone]}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}
