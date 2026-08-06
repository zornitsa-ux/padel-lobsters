import { useState } from 'react'
import { useRegistrationActions } from '../useRegistrations'

export const SELF_REGISTER_ERROR = 'Could not sign you up. Please try again.'

/**
 * A player signing themselves up, shared by the Info tab's JoinEventCard and
 * /me's RegistrationCard — the two surfaces that offer the same button.
 *
 * The error handling is the reason this is a hook rather than two inline
 * handlers: `registerPlayer` swallows the Postgres error and still reports the
 * status it *would* have used, so a null `regId` is the only signal that an RLS
 * denial, a dropped connection, or a double-tap hitting the active-registration
 * unique index failed the insert. Both callers previously ignored the result and
 * left the player looking at an unchanged "You haven't signed up yet".
 */
export function useSelfRegister({
  tournamentId,
  playerId,
  maxPlayers,
}: {
  tournamentId: string | null | undefined
  playerId: string | null
  maxPlayers: number
}) {
  const { registerPlayer } = useRegistrationActions()
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')

  const register = async () => {
    if (!tournamentId || !playerId) return
    setRegistering(true)
    setError('')
    try {
      const { regId } = await registerPlayer(tournamentId, playerId, maxPlayers)
      // A null regId is the failure signal — see the note above.
      if (!regId) setError(SELF_REGISTER_ERROR)
    } finally {
      setRegistering(false)
    }
  }

  return { register, registering, error }
}
