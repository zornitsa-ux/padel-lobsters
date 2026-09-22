import { useState } from 'react'
import { useRegistrationActions } from '../useRegistrations'

export const SELF_REGISTER_ERROR = 'Could not sign you up. Please try again.'
export const SPOT_TAKEN_ERROR = 'No spot free right now — you’re still on the waitlist.'

/**
 * A player signing themselves up, shared by the Info tab's JoinEventCard and
 * /me's RegistrationCard — the two surfaces that offer the same button.
 *
 * The error handling is the reason this is a hook rather than two inline
 * handlers: `registerPlayer` swallows the Postgres error and reports
 * status 'error', so a null `regId` is the only signal that an RLS denial or a
 * dropped connection failed the call. Both callers previously ignored the
 * result and left the player looking at an unchanged "You haven't signed up
 * yet".
 *
 * A double-tap is not an error: the second call finds the row the first one
 * created and returns 'already_registered' / 'already_waitlist' with its id.
 * The exception is a waitlisted player grabbing an open spot: 'already_waitlist'
 * then means someone else took it first, and the player needs to be told.
 */
export function useSelfRegister({
  tournamentId,
  playerId,
}: {
  tournamentId: string | null | undefined
  playerId: string | null
}) {
  const { registerPlayer } = useRegistrationActions()
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')

  const register = async () => {
    if (!tournamentId || !playerId) return
    setRegistering(true)
    setError('')
    try {
      const { regId, status } = await registerPlayer(tournamentId, playerId)
      // A null regId is the failure signal — see the note above.
      if (!regId) setError(SELF_REGISTER_ERROR)
      else if (status === 'already_waitlist') setError(SPOT_TAKEN_ERROR)
    } finally {
      setRegistering(false)
    }
  }

  return { register, registering, error }
}
