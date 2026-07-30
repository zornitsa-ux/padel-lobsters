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
 */
export function useEventPhase(
  tournament: {
    id: string
    status: string
    date?: string | null
    resultsSharedAt: string | null
  } | null,
): { phase: EventPhase; oscarsPhase: OscarsPhase } {
  const { data: matches = [] } = useMatches(tournament?.id)
  const { data: oscarsSession } = useOscarsSessionRow(tournament?.id)

  const phase = useMemo(
    () => (tournament ? eventPhase({ tournament, matches }) : 'open'),
    [tournament, matches],
  )

  // react-query's `undefined` while loading is exactly derivePhase's loading
  // sentinel; `null` means the tournament has no Oscars session row.
  const oscarsPhase = derivePhase(toPhaseSession(oscarsSession), Boolean(tournament))

  return { phase, oscarsPhase }
}
