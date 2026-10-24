import { formatEventDate } from '../registration/utils'
import type { TeamInvite } from '../teams/teamTypes'
export const TEAM_INVITES_PATH = '/team-invites'

export const inviteSeenKey = ({ playerId }: { playerId: string }) =>
  `team-invite-redirect:${playerId}`

export const eventInfoPath = ({ tournamentId }: { tournamentId: string }) =>
  `/events/${tournamentId}/info`

const EXEMPT_PREFIXES = [TEAM_INVITES_PATH, '/auth/', '/transfer/']

export const shouldRedirectToInvites = ({
  pathname,
  inviteCount,
  alreadySeen,
}: {
  pathname: string
  inviteCount: number
  alreadySeen: boolean
}): boolean =>
  inviteCount > 0 && !alreadySeen && !EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))

// Where "Not now" goes: the page the redirect interrupted, if it was ours.
export const inviteReturnPath = ({ state }: { state: unknown }): string => {
  const from = typeof state === 'object' && state !== null && 'from' in state ? state.from : null
  const ours =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.startsWith(TEAM_INVITES_PATH)
  return ours ? from : '/home'
}

export const inviteMessage = ({ invite }: { invite: TeamInvite }) =>
  `${invite.captainName} has entered you as their partner for ${invite.tournamentName} on ${formatEventDate(invite.tournamentDate)}.`
