import { useQuery } from '@tanstack/react-query'
import { getResults } from '../../api/oscars'
import type { ResultRow } from './oscarsSchemas'
import { oscarKeys } from './oscarKeys'

export function useOscarResults(tournamentId: string | null | undefined) {
  return useQuery<ResultRow[]>({
    queryKey: oscarKeys.results(tournamentId ?? ''),
    queryFn: async () => {
      const { data, error } = await getResults(tournamentId!)
      if (error) throw error
      return data
    },
    enabled: !!tournamentId,
  })
}
