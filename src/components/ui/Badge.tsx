import { BADGE_TONE_CLASSES } from './badgeTones'
import { LABEL_SHELL } from './labelShell'

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
      className={`${LABEL_SHELL} gap-1 rounded-full [&>svg]:size-3 [&>svg]:shrink-0 ${BADGE_TONE_CLASSES[tone]}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}
