import { useQueries } from '@tanstack/react-query'
import type { ResultRow } from './oscarsSchemas'
import { oscarResultsQuery } from './useOscarResults'

export interface OscarResultsForResult {
  // tournamentId → shared Oscars result rows. A tournament is absent until its
  // query resolves, and absent (not empty) when its query failed.
  byTournamentId: Record<string, ResultRow[]>
  isPending: boolean
  isError: boolean
  errors: unknown[]
}

// Shared Oscars results for many tournaments at once, one cache entry each
// (`oscarKeys.results(id)`), so a card that also mounts `useOscarResults` for a
// single tournament hits the same entry. Errors are propagated rather than
// collapsed into an empty result set.
export function useOscarResultsFor(tournamentIds: readonly string[]): OscarResultsForResult {
  return useQueries({
    queries: tournamentIds.map((id) => oscarResultsQuery(id)),
    combine: (results) => {
      const byTournamentId: Record<string, ResultRow[]> = {}
      results.forEach((result, i) => {
        if (result.data) byTournamentId[tournamentIds[i]] = result.data
      })
      return {
        byTournamentId,
        isPending: results.some((r) => r.isPending),
        isError: results.some((r) => r.isError),
        errors: results.map((r) => r.error).filter((e) => e != null),
      }
    },
  })
}
