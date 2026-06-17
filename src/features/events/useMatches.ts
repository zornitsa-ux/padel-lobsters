import { useQuery } from '@tanstack/react-query'
import { matchKeys } from './matchKeys'
import { fetchMatches, fetchAllMatches } from './matchQueries'

// Matches for a single tournament. Only fetches when tournamentId is present.
export function useMatches(tournamentId: string | null | undefined) {
  return useQuery({
    queryKey: matchKeys.list(tournamentId ?? ''),
    queryFn: () => fetchMatches(tournamentId!),
    enabled: !!tournamentId,
  })
}

// All matches across every tournament — for History and Dashboard screens
// that need cross-tournament data.
export function useAllMatches() {
  return useQuery({
    queryKey: matchKeys.all(),
    queryFn: fetchAllMatches,
  })
}
