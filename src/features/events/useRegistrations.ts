import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { registrationKeys } from './registrationKeys'
import { fetchRegistrations, fetchAllRegistrations } from './registrationQueries'
import * as q from './registrationQueries'
import type { RegistrationInput } from './registrationQueries'
import { useToast } from '../../lib/toastBus'
import {
  CANCEL_FAILURE_MESSAGES,
  PROMOTE_FAILURE_MESSAGES,
  registrationMessage,
} from './registrationStatusMessages'

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
  const { showToast } = useToast()

  const invalidateRegistrations = useCallback(
    (tournamentId?: string) =>
      qc.invalidateQueries({
        queryKey: tournamentId ? registrationKeys.list(tournamentId) : registrationKeys.all(),
      }),
    [qc],
  )

  const registerPlayer = useCallback(
    async (tournamentId: string, playerId: string) => {
      const result = await q.registerPlayer(tournamentId, playerId)
      if (result.regId) invalidateRegistrations(tournamentId)
      return result
    },
    [invalidateRegistrations],
  )

  const updateRegistration = useCallback(
    async (id: string, data: RegistrationInput, tournamentId?: string) => {
      try {
        await q.updateRegistration(id, data)
        invalidateRegistrations(tournamentId)
      } catch (error) {
        console.error('updateRegistration failed:', error)
        // Callers (Registration.tsx, Payments.tsx) fire-and-forget this call
        // with no try/catch of their own, so a thrown error here would only
        // become an unhandled rejection — surface it via toast instead.
        showToast({
          variant: 'error',
          message: 'Could not save the payment status. Please try again.',
        })
      }
    },
    [invalidateRegistrations, showToast],
  )

  // Cancelling and back-filling the freed spot is one server-side operation:
  // the promotion has to see the cancellation, and only promote when the
  // cancelled player was actually occupying a spot.
  //
  // Both writes below own their error handling for the same reason
  // updateRegistration does: callers fire them from click handlers with no
  // try/catch, so a rejection would surface as an unhandled one and the UI
  // would sit there unchanged. Every outcome that isn't the happy path gets a
  // toast, and the list is invalidated either way — a non-success status means
  // the client's view of the roster already disagrees with the server's.
  const cancelRegistration = useCallback(
    async (id: string, tournamentId: string) => {
      let result: Awaited<ReturnType<typeof q.cancelRegistration>>
      try {
        result = await q.cancelRegistration(id)
      } catch (error) {
        console.error('cancelRegistration failed:', error)
        showToast({ variant: 'error', message: CANCEL_FAILURE_MESSAGES.error })
        return { status: 'error', promotedPlayerId: null }
      }
      invalidateRegistrations(tournamentId)
      if (result.status !== 'cancelled') {
        showToast({
          variant: 'error',
          message: registrationMessage({ map: CANCEL_FAILURE_MESSAGES, status: result.status }),
        })
      }
      return result
    },
    [invalidateRegistrations, showToast],
  )

  const promoteWaitlistRegistration = useCallback(
    async (id: string, tournamentId: string) => {
      let status: string
      try {
        status = await q.promoteWaitlistRegistration(id)
      } catch (error) {
        console.error('promoteWaitlistRegistration failed:', error)
        showToast({ variant: 'error', message: PROMOTE_FAILURE_MESSAGES.error })
        return 'error'
      }
      invalidateRegistrations(tournamentId)
      if (status !== 'promoted') {
        showToast({
          variant: 'error',
          message: registrationMessage({ map: PROMOTE_FAILURE_MESSAGES, status }),
        })
      }
      return status
    },
    [invalidateRegistrations, showToast],
  )

  return {
    registerPlayer,
    updateRegistration,
    cancelRegistration,
    promoteWaitlistRegistration,
  }
}
