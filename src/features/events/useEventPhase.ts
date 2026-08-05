import { useMemo } from 'react'
import { useMatches } from './useMatches'
import { useOscarsSessionRow } from '../oscars/useOscarsSessionRow'
import { derivePhase, toPhaseSession } from '../oscars/oscarsPhase'
import { eventPhase } from './eventPhase'
import type { EventPhase } from './eventPhase'
import type { OscarsPhase } from '../oscars/oscarsPhase'

/**
 * The one place a React surface learns what phase an event is in.
 *
 * Both reads are plain mount-load queries — matches are already prefetched by
 * `useEventDataLoader`, and the Oscars session is a single row. No polling and
 * no Realtime subscription; see the flat-reads pattern.
 *
 * The two phases are returned side by side but derived independently: the
 * tournament phase never reads the Oscars session and vice versa.
 *
 * `isPending` is true while the matches query is still in flight. Most callers
 * ignore it — an event surface rendering one phase early then settling is
 * harmless. Callers that take an irreversible action on the phase (redirects)
 * must wait, because a pending matches query reads as zero matches, and zero
 * matches is indistinguishable from phase `open`.
 */
export function useEventPhase(
  tournament: {
    id: string
    status: string
    date?: string | null
    resultsSharedAt: string | null
  } | null,
): { phase: EventPhase; oscarsPhase: OscarsPhase; isPending: boolean } {
  const { data: matches = [], isPending: matchesPending } = useMatches(tournament?.id)
  const { data: oscarsSession } = useOscarsSessionRow(tournament?.id)

  const phase = useMemo(
    () => (tournament ? eventPhase({ tournament, matches }) : 'open'),
    [tournament, matches],
  )

  // react-query's `undefined` while loading is exactly derivePhase's loading
  // sentinel; `null` means the tournament has no Oscars session row.
  const oscarsPhase = derivePhase(toPhaseSession(oscarsSession), Boolean(tournament))

  // No tournament means there is nothing in flight to wait for — react-query
  // reports a disabled query as pending forever.
  return { phase, oscarsPhase, isPending: tournament != null && matchesPending }
}
