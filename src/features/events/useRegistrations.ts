import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { registrationKeys } from './registrationKeys'
import { fetchRegistrations, fetchAllRegistrations } from './registrationQueries'
import * as q from './registrationQueries'
import type { NormalisedRegistration, RegistrationInput } from './registrationQueries'

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

export function useRegistrationActions() {
  const qc = useQueryClient()

  const invalidateRegistrations = useCallback(
    (tournamentId?: string) =>
      qc.invalidateQueries({
        queryKey: tournamentId ? registrationKeys.list(tournamentId) : registrationKeys.all(),
      }),
    [qc],
  )

  const registerPlayer = useCallback(
    async (tournamentId: string, playerId: string, maxPlayers: number) => {
      // Read current count from TanStack Query cache. Falls back to 0 if the
      // cache is cold (the server's own insert-guard is the authoritative check).
      const cached =
        qc.getQueryData<NormalisedRegistration[]>(registrationKeys.list(tournamentId)) ?? []
      const current = cached.filter((r) => r.status === 'registered').length
      const result = await q.registerPlayer(tournamentId, playerId, current, maxPlayers)
      if (result.regId) invalidateRegistrations(tournamentId)
      return result
    },
    [qc, invalidateRegistrations],
  )

  const updateRegistration = useCallback(
    async (id: string, data: RegistrationInput, tournamentId?: string) => {
      try {
        await q.updateRegistration(id, data)
        invalidateRegistrations(tournamentId)
      } catch {
        /* error already logged in api */
      }
    },
    [invalidateRegistrations],
  )

  const cancelRegistration = useCallback(
    async (id: string, tournamentId: string) => {
      await q.cancelRegistration(id)
      // Promote first waitlisted player. Read the cached normalised registrations
      // (they still carry the snake_case tournament_id from the spread in normalise).
      const cached =
        qc.getQueryData<NormalisedRegistration[]>(registrationKeys.list(tournamentId)) ?? []
      await q.promoteWaitlist(tournamentId, cached)
      invalidateRegistrations(tournamentId)
    },
    [qc, invalidateRegistrations],
  )

  return { registerPlayer, updateRegistration, cancelRegistration }
}
