import { parseLevel } from '../../../../lib/parseLevel'
import type { Player } from '../../../../lib/normalise'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { EventTeam, NewPartnerInput, PartnerChoice, TeamEntry } from '../../teams/teamTypes'
import {
  getAvailablePlayers,
  isActiveRegistration,
  type DisplayName,
  type GetPlayer,
} from '../utils'

export const PARTNER_CONSENT_LABEL =
  "I have my partner's permission to register them for this event and to create a Padel Lobsters account for them with this email."

export interface NewPartnerDraft {
  name: string
  email: string
  level: string
  consent: boolean
}

export const EMPTY_DRAFT: NewPartnerDraft = { name: '', email: '', level: '', consent: false }

// Optional on this form: blank is valid; anything typed must be a level 0–7.
export const isLevelValid = ({ level }: { level: string }): boolean => {
  if (level.trim() === '') return true
  const value = parseLevel(level)
  return value !== null && value <= 7
}

export const isDraftComplete = ({ draft }: { draft: NewPartnerDraft }): boolean =>
  draft.consent &&
  draft.name.trim() !== '' &&
  draft.email.trim() !== '' &&
  isLevelValid({ level: draft.level })

export const draftToChoice = ({ draft }: { draft: NewPartnerDraft }): PartnerChoice => {
  const partner: NewPartnerInput = {
    name: draft.name.trim(),
    email: draft.email.trim(),
    playtomicLevel: parseLevel(draft.level),
  }
  return { kind: 'new', partner, consent: draft.consent }
}

// Back from the confirm step reopens the form as the captain left it.
export const choiceToDraft = ({ choice }: { choice: PartnerChoice | null }): NewPartnerDraft =>
  choice?.kind === 'new'
    ? {
        name: choice.partner.name,
        email: choice.partner.email,
        level: choice.partner.playtomicLevel === null ? '' : String(choice.partner.playtomicLevel),
        consent: choice.consent,
      }
    : EMPTY_DRAFT

export const eligiblePlayers = ({
  players,
  regs,
  excludeIds = [],
}: {
  players: Player[]
  regs: NormalisedRegistration[]
  excludeIds?: Array<string | null>
}): Player[] => getAvailablePlayers({ players, regs }).filter((p) => !excludeIds.includes(p.id))

// Case and accents ignored ("jime" finds Jiménez); every typed fragment must
// appear somewhere in the name, in any order ("gar nic" finds Nicolas Garcia).
const foldName = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const filterByName = ({ players, search }: { players: Player[]; search: string }) => {
  const fragments = foldName(search).split(/\s+/).filter(Boolean)
  if (fragments.length === 0) return players
  return players.filter((p) => {
    const name = foldName(p.name)
    return fragments.every((f) => name.includes(f))
  })
}

export const choicePartnerName = ({
  choice,
  getPlayer,
}: {
  choice: PartnerChoice
  getPlayer: GetPlayer
}): string =>
  choice.kind === 'new' ? choice.partner.name : (getPlayer(choice.playerId)?.name ?? '')

// Blank when the player isn't loaded; callers choose the fallback.
export const playerNameOf = ({
  playerId,
  getPlayer,
  displayName,
}: {
  playerId: string
  getPlayer: GetPlayer
  displayName: DisplayName
}) => {
  const p = getPlayer(playerId)
  return p ? displayName(p) : ''
}

export const teamLabel = ({
  entry,
  getPlayer,
  displayName,
}: {
  entry: TeamEntry
  getPlayer: GetPlayer
  displayName: DisplayName
}): string =>
  [entry.captain, entry.partner]
    .map((reg) => playerNameOf({ playerId: reg.playerId, getPlayer, displayName }))
    .filter(Boolean)
    .join(' & ')

export const partnerNameOf = ({
  entry,
  getPlayer,
  displayName,
}: {
  entry: TeamEntry
  getPlayer: GetPlayer
  displayName: DisplayName
}): string =>
  playerNameOf({ playerId: entry.partner.playerId, getPlayer, displayName }) || 'the partner'

export const signupNotices = ({
  status,
  choice,
  partnerName,
  viewerIsCaptain,
}: {
  status: string
  choice: PartnerChoice
  partnerName: string
  viewerIsCaptain: boolean
}): string[] => {
  const waitlistNotice = viewerIsCaptain
    ? "You're both on the waitlist."
    : 'The team is on the waitlist.'
  const base =
    status === 'waitlist'
      ? [waitlistNotice]
      : [viewerIsCaptain ? `You and ${partnerName} are signed up.` : 'The team is signed up.']
  const ask =
    choice.kind === 'new'
      ? `${partnerName} can sign in with ${choice.partner.email} to accept. Let them know!`
      : `We've asked ${partnerName} to accept in the app. Let them know!`
  return [...base, ask]
}

export const teamCount = ({ players }: { players: number }): number => Math.floor(players / 2)

// Counted from the team entries, so the line always matches the team lists.
export const rosterLine = ({
  entries,
  maxPlayers,
}: {
  entries: TeamEntry[]
  maxPlayers: number
}): { main: string; waiting: string | null } => {
  const registered = entries.filter((e) => e.status === 'registered').length
  const waiting = entries.length - registered
  return {
    main: `${registered} of ${teamCount({ players: maxPlayers })} teams`,
    waiting: waiting > 0 ? `${waiting} ${waiting === 1 ? 'team' : 'teams'} waiting` : null,
  }
}

export type EndedTeamNotice = { kind: 'partner_declined' | 'admin_cancelled'; partnerName: string }

const cancelledTeamOf = ({
  teams,
  regs,
  viewerId,
}: {
  teams: EventTeam[]
  regs: NormalisedRegistration[]
  viewerId: string
}): EventTeam | null => {
  const mine = new Set(regs.filter((r) => r.playerId === viewerId && r.teamId).map((r) => r.teamId))
  const own = teams.filter((t) => t.captainId === viewerId || mine.has(t.id))
  return own.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

// The viewer's latest team here when it ended without them cancelling it.
// Only a captain is told about a decline; their partner just declined.
export const endedTeamNotice = ({
  teams,
  regs,
  viewerId,
  getPlayer,
  displayName,
}: {
  teams: EventTeam[]
  regs: NormalisedRegistration[]
  viewerId: string
  getPlayer: GetPlayer
  displayName: DisplayName
}): EndedTeamNotice | null => {
  const hasActive = regs.some((r) => r.playerId === viewerId && isActiveRegistration(r))
  const team = hasActive ? null : cancelledTeamOf({ teams, regs, viewerId })
  const reason = team?.cancelledReason
  if (!team || (reason !== 'partner_declined' && reason !== 'admin_cancelled')) return null
  if (reason === 'partner_declined' && team.captainId !== viewerId) return null
  const other = regs.find((r) => r.teamId === team.id && r.playerId !== viewerId)
  const otherPlayer = other ? getPlayer(other.playerId) : undefined
  return { kind: reason, partnerName: otherPlayer ? displayName(otherPlayer) : 'Your partner' }
}

export const findMyEntry = ({
  entries,
  playerId,
}: {
  entries: TeamEntry[]
  playerId: string | null
}): TeamEntry | null =>
  playerId
    ? (entries.find((e) => e.captain.playerId === playerId || e.partner.playerId === playerId) ??
      null)
    : null

export const notSignedInHint = ({
  captainUnseen,
  partnerUnseen,
}: {
  captainUnseen: boolean
  partnerUnseen: boolean
}): string | null => {
  if (captainUnseen && partnerUnseen) return 'Neither player has signed in yet'
  if (captainUnseen) return "Captain hasn't signed in yet"
  if (partnerUnseen) return "Partner hasn't signed in yet"
  return null
}

export const declineMessage = ({ captainName }: { captainName: string }) =>
  `If you're not playing, ${captainName}'s team is cancelled. We keep spots for complete teams, so the spots go to the next team on the waitlist.`
