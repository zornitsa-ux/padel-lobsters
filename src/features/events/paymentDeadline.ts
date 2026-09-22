export const DEFAULT_GRACE_HOURS = 48
export const MIN_GRACE_HOURS = 1
export const MAX_GRACE_HOURS = 168

const deadlineParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Amsterdam',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// "Thu 24 Sep, 18:00" in Amsterdam time (en-US parts: en-GB says "Sept") — the same rendering the WhatsApp
// message gets from get_payment_reminder, so the admin sees what the player sees.
export function formatDeadline(iso: string): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    deadlineParts.formatToParts(new Date(iso)).find((p) => p.type === type)?.value ?? ''
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`
}

// Whole hours in range, or null while the field holds something unusable
// (empty, 0, 500) — the caller keeps the last good link instead of refetching.
export function parseGraceHours(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < MIN_GRACE_HOURS || n > MAX_GRACE_HOURS) return null
  return n
}

// Badge text for an active deadline. Past-due rows are still 'active' until
// the hourly job (quarter past) runs: it releases the spot only if the player
// is still unpaid, and spares 'tikkied' / 'pending_confirmation'.
export function deadlineBadge({
  deadlineAt,
  now,
  unpaid,
}: {
  deadlineAt: string
  now: Date
  unpaid: boolean
}) {
  const overdue = new Date(deadlineAt).getTime() <= now.getTime()
  if (!overdue) return { overdue, text: `Pay by ${formatDeadline(deadlineAt)}` }
  return {
    overdue,
    text: unpaid ? 'Deadline passed · releasing spot' : 'Deadline passed · check their payment',
  }
}
