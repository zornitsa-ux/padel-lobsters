import { useQuery } from '@tanstack/react-query'
import { registrationKeys } from './registrationKeys'
import { fetchRegistrations, fetchAllRegistrations } from './registrationQueries'

// Registrations for a single tournament. Only fetches when tournamentId is present.
export function useRegistrations(tournamentId: string | null | undefined) {
  return useQuery({
    queryKey: registrationKeys.list(tournamentId ?? ''),
    queryFn: () => fetchRegistrations(tournamentId!),
    enabled: !!tournamentId,
  })
}

// All registrations across every tournament — for History and Dashboard screens.
export function useAllRegistrations() {
  return useQuery({
    queryKey: registrationKeys.all(),
    queryFn: fetchAllRegistrations,
  })
}
