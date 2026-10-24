import { useState } from 'react'
import { registrationMessage } from '../../registrationStatusMessages'
import { REGISTER_TEAM_MESSAGES } from '../../teams/teamStatusMessages'
import { useTeamActions } from '../../teams/useTeams'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { GetPlayer } from '../utils'
import { choicePartnerName, signupNotices } from './teamHelpers'

export interface TeamSignupResult {
  teamId: string | null
  captainId: string
  status: 'registered' | 'waitlist'
  notices: string[]
}

/** Submits a team and reports the outcome; failures stay inline as `error`. */
export function useTeamSignup({
  tournamentId,
  captainId,
  viewerIsCaptain,
  getPlayer,
  onSignedUp,
}: {
  tournamentId: string
  captainId: string | null
  viewerIsCaptain: boolean
  getPlayer: GetPlayer
  onSignedUp: (result: TeamSignupResult) => void
}) {
  const { registerTeam } = useTeamActions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async ({ choice }: { choice: PartnerChoice }) => {
    if (!captainId) return
    setBusy(true)
    setError('')
    const { status, teamId, partnerId } = await registerTeam({ tournamentId, captainId, choice })
    setBusy(false)
    if (status !== 'registered' && status !== 'waitlist') {
      setError(registrationMessage({ map: REGISTER_TEAM_MESSAGES, status }))
      return false
    }
    const partnerName =
      choicePartnerName({ choice, getPlayer }) || getPlayer(partnerId)?.name || 'Your partner'
    const notices = signupNotices({ status, choice, partnerName, viewerIsCaptain })
    onSignedUp({ teamId, captainId, status, notices })
    return true
  }

  return { submit, busy, error, clearError: () => setError('') }
}
