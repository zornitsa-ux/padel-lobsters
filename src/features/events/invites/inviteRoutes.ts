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

export const inviteMessage = ({ invite }: { invite: TeamInvite }) =>
  `${invite.captainName} has entered you as their partner for ${invite.tournamentName} on ${formatEventDate(invite.tournamentDate)}.`
