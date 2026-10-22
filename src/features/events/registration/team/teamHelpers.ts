import { pricePerPlayer } from '../../eventHelpers'
import type { Player } from '../../../../lib/normalise'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { NewPartnerInput, PartnerChoice, TeamEntry } from '../../teams/teamTypes'
import type { DisplayName, GetPlayer } from '../utils'

export const PARTNER_CONSENT_LABEL =
  "I have my partner's permission to register them for this event and to create a Padel Lobsters account for them with this email."

export interface NewPartnerDraft {
  name: string
  email: string
  level: string
  consent: boolean
}

export const EMPTY_DRAFT: NewPartnerDraft = { name: '', email: '', level: '', consent: false }

export const isDraftComplete = ({ draft }: { draft: NewPartnerDraft }): boolean =>
  draft.consent && draft.name.trim() !== '' && draft.email.trim() !== ''

const parseLevel = (level: string): number | null => {
  const trimmed = level.trim()
  return trimmed === '' ? null : Number(trimmed.replace(',', '.'))
}

export const draftToChoice = ({ draft }: { draft: NewPartnerDraft }): PartnerChoice => {
  const partner: NewPartnerInput = {
    name: draft.name.trim(),
    email: draft.email.trim(),
    playtomicLevel: parseLevel(draft.level),
  }
  return { kind: 'new', partner, consent: draft.consent }
}

export const eligiblePlayers = ({
  players,
  regs,
  excludeIds = [],
}: {
  players: Player[]
  regs: NormalisedRegistration[]
  excludeIds?: Array<string | null>
}): Player[] => {
  const entered = new Set(
    regs.filter((r) => r.status === 'registered' || r.status === 'waitlist').map((r) => r.playerId),
  )
  return players.filter(
    (p) => p.status === 'active' && !entered.has(p.id) && !excludeIds.includes(p.id),
  )
}

export const filterByName = ({ players, search }: { players: Player[]; search: string }) => {
  const q = search.trim().toLowerCase()
  return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players
}

export const teamPrice = ({ tournament }: { tournament: Parameters<typeof pricePerPlayer>[0] }) =>
  2 * pricePerPlayer(tournament)

export const choicePartnerName = ({
  choice,
  getPlayer,
}: {
  choice: PartnerChoice
  getPlayer: GetPlayer
}): string =>
  choice.kind === 'new' ? choice.partner.name : (getPlayer(choice.playerId)?.name ?? '')

const nameOf = ({
  reg,
  getPlayer,
  displayName,
}: {
  reg: NormalisedRegistration
  getPlayer: GetPlayer
  displayName: DisplayName
}) => {
  const p = getPlayer(reg.playerId)
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
    .map((reg) => nameOf({ reg, getPlayer, displayName }))
    .filter(Boolean)
    .join(' & ')

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
  return choice.kind === 'new'
    ? [
        ...base,
        `${partnerName} can sign in with ${choice.partner.email} any time to see the event. Let them know!`,
      ]
    : base
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
