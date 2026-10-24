import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../../context/useApp'
import { readStorage, writeStorage } from '../../../lib/safeStorage'
import { useMyAccountSetup, useMyTeamInvites } from '../teams/useTeams'
import { inviteSeenKey, redirectTarget, TEAM_INVITES_PATH } from './inviteRoutes'

// A captain-created account goes to finish setup on every page until it's done
// (D-021). After that, a player with pending team invites goes to the
// acceptance screen once per browser session (D-019). The ref backs up
// sessionStorage, which can be unavailable, so a failed write can't cause a
// redirect loop. It holds the player redirected, so another account signing in
// on the same tab still is.
export default function TeamInviteRedirect() {
  const { session } = useApp()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const playerId = session?.user?.id ?? null
  const setupQuery = useMyAccountSetup({ enabled: !!playerId })
  const setup = setupQuery.data ?? null
  const setupPending = setupQuery.isPending
  const { data: invites = [] } = useMyTeamInvites({ enabled: !!playerId })
  const invitesShownTo = useRef<string | null>(null)
  const needsAccountSetup = !!setup && !setup.acknowledged

  useEffect(() => {
    // Decide only once we know whether setup is owed, so invites never come first.
    if (!playerId || setupPending) return
    const key = inviteSeenKey({ playerId })
    const alreadySeen =
      invitesShownTo.current === playerId || readStorage({ area: 'session', key }) !== null
    const target = redirectTarget({
      pathname,
      needsAccountSetup,
      inviteCount: invites.length,
      alreadySeen,
    })
    if (!target) return
    if (target === TEAM_INVITES_PATH) {
      invitesShownTo.current = playerId
      writeStorage({ area: 'session', key, value: '1' })
    }
    navigate(target, { state: { from: pathname + search } })
  }, [playerId, setupPending, pathname, search, needsAccountSetup, invites.length, navigate])

  return null
}
