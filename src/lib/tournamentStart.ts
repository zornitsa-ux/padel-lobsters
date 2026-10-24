// Parses an event's start instant. Shared by the home countdown and the event
// lifecycle (King of the Court is over at start + duration).

// Only the two fields the start reads, so a NormalisedTournament and the
// lighter shapes tests build both satisfy it.
export interface CountdownTournament {
  date?: string | null
  time?: string | null
}

const DEFAULT_HOUR = 19

// Parses the tournament's local start instant. "YYYY-MM-DD" plus an optional
// time in "19:30" / "19.30" / "7pm" / "7:30 pm" / "19" form, defaulting to
// 19:00. Local, not UTC, so the countdown matches the player's own clock.
export function tournamentStartMs(
  tournament: CountdownTournament | null | undefined,
): number | null {
  const dateStr = tournament?.date
  if (!dateStr) return null
  const [y, mo, d] = dateStr.split('-').map(Number)
  if (!y || !mo || !d) return null

  let hh = DEFAULT_HOUR
  let mm = 0
  const timeStr = (tournament?.time || '').trim()
  if (timeStr) {
    const ampm = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    const hm = timeStr.match(/^(\d{1,2})[:.](\d{2})$/)
    const hOnly = timeStr.match(/^(\d{1,2})$/)
    if (ampm) {
      hh = parseInt(ampm[1], 10) % 12
      if (/pm/i.test(ampm[3])) hh += 12
      mm = parseInt(ampm[2] || '0', 10)
    } else if (hm) {
      hh = parseInt(hm[1], 10)
      mm = parseInt(hm[2], 10)
    } else if (hOnly) {
      hh = parseInt(hOnly[1], 10)
    }
  }
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime()
}
