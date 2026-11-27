import { ratingsOn } from './presets'
import { tournamentStartMs } from '../../lib/tournamentStart'
import { DEFAULT_EVENT_DURATION_MINUTES } from '../../lib/normalise'

/** Only the tournament fields the finished rule reads. */
export type OverTournament = {
  status: string
  format?: string | null
  date?: string | null
  time?: string | null
  duration?: number | null
}

/** The scheduled end: start + duration (90 minutes when none is stored). */
export function eventEndMs(
  tournament: Pick<OverTournament, 'date' | 'time' | 'duration'>,
): number | null {
  const start = tournamentStartMs(tournament)
  const minutes = tournament.duration ?? DEFAULT_EVENT_DURATION_MINUTES
  return start == null ? null : start + minutes * 60_000
}

/**
 * Finished at the scheduled end, for every format, or once ratings are applied
 * (event-system EV-D1). The database's `private.event_finished` is the same
 * rule; both run the cases in supabase/tests/event_finished_cases.json.
 */
export function isEventFinished({
  tournament,
  now = new Date(),
}: {
  tournament: OverTournament
  now?: Date
}): boolean {
  if (tournament.status === 'completed') return true
  const end = eventEndMs(tournament)
  return end != null && now.getTime() >= end
}

/**
 * Whether admins can still change the roster (add, cancel, transfer). A rated
 * event stays open until its ratings are applied, so who played can be fixed
 * first; any other event closes when it finishes (event-system EV-D3).
 */
export function isRosterLocked({
  tournament,
  now = new Date(),
}: {
  tournament: OverTournament
  now?: Date
}): boolean {
  if (ratingsOn(tournament)) return tournament.status === 'completed'
  return isEventFinished({ tournament, now })
}
