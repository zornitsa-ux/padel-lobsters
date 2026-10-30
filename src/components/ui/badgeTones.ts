import type { BadgeTone } from './Badge'

/** Fill and text per tone; also tints a row's avatar to match its status badge. */
export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-lob-success-soft text-lob-success',
  warning: 'bg-lob-warning-soft text-lob-warning',
  danger: 'bg-lob-danger-soft text-lob-danger',
  info: 'bg-lob-info-soft text-lob-info',
  neutral: 'bg-lob-line text-lob-slate',
  brand: 'bg-lob-teal-light text-lob-teal',
  outline: 'bg-white text-lob-slate ring-1 ring-inset ring-lob-line-strong',
  accent: 'bg-lob-amber/15 text-lob-amber-strong',
}
