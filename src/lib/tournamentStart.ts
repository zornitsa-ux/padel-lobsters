// Parses an event's start instant. Shared by the home countdown and the event
// lifecycle (King of the Court is over at start + duration).

// Only the two fields the start reads, so a NormalisedTournament and the
// lighter shapes tests build both satisfy it.
export interface CountdownTournament {
  date?: string | null
  time?: string | null
}

const DEFAULT_HOUR = 19

// HH:MM or HH.MM, 00:00–23:59. Anything else (missing, blank, "TBD", "7pm")
// starts at 19:00, exactly as the database's tournament_start_ts reads it, so
// the client and the server agree on when an event starts and finishes
// (event-system EV-D4; cases in supabase/tests/event_finished_cases.json).
const TIME = /^([01]?[0-9]|2[0-3])[:.]([0-5][0-9])$/

// Parses the tournament's local start instant: "YYYY-MM-DD" plus the time
// above. Local, not UTC, so the countdown matches the player's own clock.
export function tournamentStartMs(
  tournament: CountdownTournament | null | undefined,
): number | null {
  const dateStr = tournament?.date
  if (!dateStr) return null
  const [y, mo, d] = dateStr.split('-').map(Number)
  if (!y || !mo || !d) return null

  const hm = (tournament?.time || '').trim().match(TIME)
  const hh = hm ? parseInt(hm[1], 10) : DEFAULT_HOUR
  const mm = hm ? parseInt(hm[2], 10) : 0
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime()
}
