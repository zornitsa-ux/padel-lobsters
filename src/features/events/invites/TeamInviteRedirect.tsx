import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../../context/useApp'
import { readStorage, writeStorage } from '../../../lib/safeStorage'
import { useMyTeamInvites } from '../teams/useTeams'
import { inviteSeenKey, shouldRedirectToInvites, TEAM_INVITES_PATH } from './inviteRoutes'

// Sends a player with pending team invites to the acceptance screen once per
// browser session (D-019). The ref backs up sessionStorage, which can be
// unavailable, so a failed write can't cause a redirect loop. It holds the
// player redirected, so another account signing in on the same tab still is.
export default function TeamInviteRedirect() {
  const { session } = useApp()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const playerId = session?.user?.id ?? null
  const { data: invites = [] } = useMyTeamInvites({ enabled: !!playerId })
  const redirected = useRef<string | null>(null)

  useEffect(() => {
    if (!playerId || redirected.current === playerId) return
    const key = inviteSeenKey({ playerId })
    const alreadySeen = readStorage({ area: 'session', key }) !== null
    if (!shouldRedirectToInvites({ pathname, inviteCount: invites.length, alreadySeen })) return
    redirected.current = playerId
    writeStorage({ area: 'session', key, value: '1' })
    navigate(TEAM_INVITES_PATH, { state: { from: pathname + search } })
  }, [playerId, pathname, search, invites.length, navigate])

  return null
}
