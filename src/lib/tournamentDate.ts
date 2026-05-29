// Returns today's date as a YYYY-MM-DD string in the user's local timezone.
// Using arithmetic avoids the UTC-offset misclassification that `new Date().toISOString()` causes.
export function localDateString(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Returns true only when the tournament date is strictly before today (local time).
// A tournament whose date equals today is NOT considered past — the draw runs on the day.
//
// `now` is injectable for testing — production callers should leave it default
// so the function reads from the real clock.
export function isTournamentPast(
  tournamentDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!tournamentDate) return false
  return tournamentDate < localDateString(now)
}
