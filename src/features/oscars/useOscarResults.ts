import { useQuery } from '@tanstack/react-query'
import { getResults } from '../../api/oscars'
import type { ResultRow } from './oscarsSchemas'
import { oscarKeys } from './oscarKeys'

// Shared by the single-id hook and the multi-id `useOscarResultsFor` so both
// resolve to the same cache entry per tournament.
export function oscarResultsQuery(tournamentId: string) {
  return {
    queryKey: oscarKeys.results(tournamentId),
    queryFn: async (): Promise<ResultRow[]> => {
      const { data, error } = await getResults(tournamentId)
      if (error) throw error
      return data
    },
  }
}

export function useOscarResults(tournamentId: string | null | undefined) {
  return useQuery<ResultRow[]>({
    ...oscarResultsQuery(tournamentId ?? ''),
    enabled: !!tournamentId,
  })
}
