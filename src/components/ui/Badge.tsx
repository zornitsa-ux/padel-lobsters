export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'brand'
  | 'outline'
  | 'accent'

export interface BadgeProps {
  tone: BadgeTone
  label: string
  icon?: React.ReactNode
  title?: string
}

export const BADGE_TONES: readonly BadgeTone[] = [
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'brand',
  'outline',
  'accent',
]

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

export function Badge({ tone, label, icon, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold [&>svg]:size-3 [&>svg]:shrink-0 ${toneClasses[tone]}`}
    >
      {icon}
      {label}
    </span>
  )
}
