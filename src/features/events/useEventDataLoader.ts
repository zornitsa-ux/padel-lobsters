import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { matchKeys } from './matchKeys'
import { registrationKeys } from './registrationKeys'
import { fetchMatches } from './matchQueries'
import { fetchRegistrations } from './registrationQueries'
import useRefreshOnFocus from '../../hooks/useRefreshOnFocus'

// Ensures match and registration queries are active when any event sub-route
// mounts. TanStack Query will fetch if the cache is cold and skip if it's
// already fresh — no duplicate requests within the staleTime window.
// Called by useTournamentFromUrl() so every event route gets it for free.
export function useEventDataLoader() {
  const { id: tournamentId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tournamentId) return
    queryClient.prefetchQuery({
      queryKey: matchKeys.list(tournamentId),
      queryFn: () => fetchMatches(tournamentId),
    })
    queryClient.prefetchQuery({
      queryKey: registrationKeys.list(tournamentId),
      queryFn: () => fetchRegistrations(tournamentId),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  useRefreshOnFocus(() => {
    if (!tournamentId) return
    queryClient.invalidateQueries({ queryKey: matchKeys.list(tournamentId) })
    queryClient.invalidateQueries({ queryKey: registrationKeys.list(tournamentId) })
  })
}
