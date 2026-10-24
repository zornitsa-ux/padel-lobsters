import { formatEventDate } from '../registration/utils'
import type { TeamInvite } from '../teams/teamTypes'
export const TEAM_INVITES_PATH = '/team-invites'
export const FINISH_ACCOUNT_PATH = '/finish-account'

export const inviteSeenKey = ({ playerId }: { playerId: string }) =>
  `team-invite-redirect:${playerId}`

export const eventInfoPath = ({ tournamentId }: { tournamentId: string }) =>
  `/events/${tournamentId}/info`

const EXEMPT_PREFIXES = [TEAM_INVITES_PATH, FINISH_ACCOUNT_PATH, '/auth/', '/transfer/']
const isExempt = ({ pathname }: { pathname: string }) =>
  EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))

// A captain-created account must finish setup first, on every page (D-021).
// Invites are shown once per browser session.
export const redirectTarget = ({
  pathname,
  needsAccountSetup,
  inviteCount,
  alreadySeen,
}: {
  pathname: string
  needsAccountSetup: boolean
  inviteCount: number
  alreadySeen: boolean
}): string | null => {
  if (isExempt({ pathname })) return null
  if (needsAccountSetup) return FINISH_ACCOUNT_PATH
  if (inviteCount > 0 && !alreadySeen) return TEAM_INVITES_PATH
  return null
}

// Where "Not now" goes: the page the redirect interrupted, if it was ours.
export const inviteReturnPath = ({ state }: { state: unknown }): string => {
  const from = typeof state === 'object' && state !== null && 'from' in state ? state.from : null
  const ours =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !isExempt({ pathname: from })
  return ours ? from : '/home'
}

export const inviteWhen = ({ invite }: { invite: TeamInvite }) =>
  [formatEventDate(invite.tournamentDate), invite.tournamentTime].filter(Boolean).join(' · ')
