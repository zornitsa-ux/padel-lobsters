import { useQuery } from '@tanstack/react-query'
import { loadSession } from '../../api/oscars'
import type { SessionRow } from './oscarsSchemas'
import { oscarKeys } from './oscarKeys'

// The `lobster_oscars_sessions` row for one tournament. `lobster_oscars_sessions`
// is owned by this slice, so consumers outside it (e.g. the events results
// banner) read the row through here rather than querying the table directly.
//
// Options are factored out the same way `oscarResultsQuery` is, so any future
// multi-tournament hook shares this key and fetcher instead of drifting.
export function oscarsSessionQuery(tournamentId: string) {
  return {
    queryKey: oscarKeys.session(tournamentId),
    queryFn: async (): Promise<SessionRow | null> => {
      const { data, error } = await loadSession(tournamentId)
      // A failed read must not look like "this tournament has no Oscars
      // session" — the caller sees isError, not a confident null.
      if (error) throw error
      return data
    },
  }
}

export function useOscarsSessionRow(tournamentId: string | null | undefined) {
  return useQuery<SessionRow | null>({
    ...oscarsSessionQuery(tournamentId ?? ''),
    enabled: !!tournamentId,
  })
}
