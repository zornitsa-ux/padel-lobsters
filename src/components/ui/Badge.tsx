import { BADGE_TONE_CLASSES } from './badgeTones'

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

// Shrinks under pressure and truncates the label rather than overflowing a
// narrow row; the icon keeps its size.
export function Badge({ tone, label, icon, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold [&>svg]:size-3 [&>svg]:shrink-0 ${BADGE_TONE_CLASSES[tone]}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}
