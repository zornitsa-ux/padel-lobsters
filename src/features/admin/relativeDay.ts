const DAY_MS = 24 * 60 * 60 * 1000

export function relativeDay({ iso, now }: { iso: string; now: Date }): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
