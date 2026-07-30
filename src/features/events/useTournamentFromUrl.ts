import { useParams } from 'react-router-dom'
import { useTournaments } from './useTournaments'
import { useEventDataLoader } from './useEventDataLoader'
import type { NormalisedTournament } from '../../lib/normalise'

/**
 * Look up a tournament by URL `:id`.
 *
 * `isPending` is returned separately from the tournament because collapsing the
 * two is a bug: `useTournaments()` yields `data === undefined` while in flight,
 * so a cold deep link (WhatsApp message, bookmark, refresh, calendar invite)
 * looked identical to "this id does not exist" and every event route redirected
 * away in its first render pass — destroying the URL with `replace` so Back
 * could not recover it.
 *
 * Also mounts `useEventDataLoader` so matches + registrations load lazily
 * whenever an event route is active.
 */
export function useTournamentFromUrl(): {
  tournament: NormalisedTournament | null
  isPending: boolean
} {
  const { id } = useParams()
  const { data: tournaments, isPending } = useTournaments()
  useEventDataLoader()
  const tournament = (tournaments ?? []).find((t) => String(t.id) === String(id)) ?? null
  return { tournament, isPending }
}
