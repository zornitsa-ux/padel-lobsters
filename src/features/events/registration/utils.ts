import type { Player } from '../../../lib/normalise'
import type { NormalisedRegistration } from '../registrationQueries'
import type { NormalisedMatch } from '../matchQueries'
import type { NormalisedTransfer } from '../transferQueries'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

// Lookups the Registration container hands down to every section.
export type GetPlayer = (id: string | null | undefined) => Player | undefined
/** First name for players, full name for admins. */
export type DisplayName = (player: Player) => string

// Post-registration payment sheet state.
// `paymentStatus` is the registration's *payment* status, which is what the
// sheet's Tikkie handler guards on (`markTikkied` only upgrades unpaid → tikkied).
// The registration status ('registered' / 'waitlist') deliberately does not
// travel: it is a precondition the container checks before opening the sheet at
// all, and nothing inside the sheet reads it.
export interface PaymentSheet {
  regId: string
  playerId: string
  paymentStatus: string
}

export interface TransferShareTarget {
  transferId: string
  toPlayer: Player
}

export interface RegistrationSplit {
  registered: NormalisedRegistration[]
  waitlisted: NormalisedRegistration[]
  cancelled: NormalisedRegistration[]
}

export interface InTournamentPlayerIds {
  registeredIds: string[]
  waitlistedIds: string[]
  inTournamentIds: string[]
}

export interface PaymentConfig {
  isAdminAll: boolean
  hasTikkie: boolean
  costPerPlayer: number
}

// The subset of a tournament that decides how a player pays.
// NormalisedTournament satisfies it.
export interface PayableEvent {
  courtBookingMode?: string | null
  totalPrice?: number | null
  maxPlayers?: number | null
  tikkieLink?: string | null
  courts?: ReadonlyArray<{
    costPerPerson?: string | number | null
    tikkieLink?: string | null
  }> | null
}

// One row of the per-tournament ranking table. `pf`/`pa` are game points
// for/against, `pts` is the running total used as the primary sort key.
export interface RankingRow {
  player: Player
  played: number
  won: number
  lost: number
  pf: number
  pa: number
  pts: number
}

export type MatchesByRound = Record<number, NormalisedMatch[]>

const byRegisteredAt = (a: NormalisedRegistration, b: NormalisedRegistration): number =>
  (a.registeredAt?.seconds || 0) - (b.registeredAt?.seconds || 0)

export const splitRegistrationsByStatus = (
  regs: NormalisedRegistration[] = [],
): RegistrationSplit => {
  const registered = regs.filter((r) => r.status === 'registered').sort(byRegisteredAt)
  const waitlisted = regs.filter((r) => r.status === 'waitlist').sort(byRegisteredAt)
  const cancelled = regs.filter((r) => r.status === 'cancelled')
  return { registered, waitlisted, cancelled }
}

export const getInTournamentPlayerIds = (
  regs: NormalisedRegistration[] = [],
): InTournamentPlayerIds => {
  const registeredIds = regs.filter((r) => r.status === 'registered').map((r) => r.playerId)
  const waitlistedIds = regs.filter((r) => r.status === 'waitlist').map((r) => r.playerId)
  return { registeredIds, waitlistedIds, inTournamentIds: [...registeredIds, ...waitlistedIds] }
}

export const getAvailablePlayers = ({
  players = [],
  regs = [],
  search = '',
}: {
  players?: Player[]
  regs?: NormalisedRegistration[]
  search?: string
}): Player[] => {
  const q = String(search || '').toLowerCase()
  const { inTournamentIds } = getInTournamentPlayerIds(regs)
  return players
    .filter((p) => (p.status || 'active') === 'active')
    .filter((p) => !inTournamentIds.includes(p.id) && (p.name?.toLowerCase().includes(q) || !q))
}

export const computePaymentConfig = (
  tournament: PayableEvent | null | undefined,
): PaymentConfig => {
  const isAdminAll = !tournament?.courtBookingMode || tournament.courtBookingMode === 'admin_all'
  const hasTikkie = isAdminAll
    ? !!tournament?.tikkieLink
    : (tournament?.courts || []).some((c) => c.tikkieLink)
  const totalPrice = tournament?.totalPrice ?? 0
  const costPerPlayer = isAdminAll
    ? totalPrice > 0
      ? totalPrice / (tournament?.maxPlayers || 1)
      : 0
    : (tournament?.courts || []).reduce(
        (s, c) => s + (parseFloat(String(c.costPerPerson ?? '')) || 0),
        0,
      )

  return { isAdminAll, hasTikkie, costPerPlayer }
}

export const formatEventDate = (dateValue: string | number | Date | null | undefined): string => {
  if (!dateValue) return '—'
  return new Date(dateValue).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export const isWithinResultsWindow = (
  tournamentDate: string | number | Date | null | undefined,
): boolean => {
  if (!tournamentDate) return false
  const refMs = new Date(tournamentDate).getTime()
  if (Number.isNaN(refMs)) return false
  const elapsed = Date.now() - refMs
  return elapsed >= -TWO_DAYS_MS && elapsed < TWO_DAYS_MS
}

export const getPendingTransfersForTournament = (
  transfers: NormalisedTransfer[] = [],
  tournamentId: string | number | null | undefined,
): NormalisedTransfer[] =>
  transfers.filter((t) => t.status === 'pending' && String(t.tournamentId) === String(tournamentId))

export const getPendingFromPlayer = (
  pendingTransfers: NormalisedTransfer[] = [],
  playerId: string | null | undefined,
): NormalisedTransfer | undefined =>
  pendingTransfers.find((t) => playerId && String(t.fromPlayerId) === String(playerId))

export const getIncomingForPlayer = (
  pendingTransfers: NormalisedTransfer[] = [],
  playerId: string | null | undefined,
): NormalisedTransfer[] =>
  pendingTransfers.filter((t) => playerId && String(t.toPlayerId) === String(playerId))

export const buildPendingByFromPlayerId = (
  pendingTransfers: NormalisedTransfer[] = [],
): Map<string, NormalisedTransfer> =>
  new Map(pendingTransfers.map((t) => [String(t.fromPlayerId), t]))

const courtOrder = (label: string | null | undefined): number => {
  const m = String(label ?? '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}

export const groupMatchesByRound = (matches: NormalisedMatch[] = []): MatchesByRound => {
  const byRound: MatchesByRound = {}
  matches.forEach((m) => {
    const r = m.round || 1
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(m)
  })

  Object.keys(byRound).forEach((r) => {
    byRound[Number(r)].sort((a, b) => courtOrder(a.court) - courtOrder(b.court))
  })

  return byRound
}

export const getSortedRoundNumbers = (byRound: MatchesByRound = {}): number[] =>
  Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b)

export const getPlayerFirstName = (
  players: Player[] = [],
  playerId: string | null | undefined,
): string => {
  const p = players.find((x) => x.id === playerId)
  return p ? p.name.split(' ')[0] : '?'
}

export const computeRankings = ({
  matches = [],
  regs = [],
  players = [],
}: {
  matches?: NormalisedMatch[]
  regs?: NormalisedRegistration[]
  players?: Player[]
}): RankingRow[] => {
  const registeredRegs = regs.filter((r) => r.status === 'registered')
  const regPlayerIds = registeredRegs.map((r) => r.playerId)

  const stats: Record<string, RankingRow> = {}
  regPlayerIds.forEach((id) => {
    const p = players.find((x) => x.id === id)
    if (p) stats[id] = { player: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, pts: 0 }
  })

  matches.forEach((m) => {
    const s1 = m.score1
    const s2 = m.score2
    if (!m.completed || s1 == null || s2 == null) return
    const t1won = s1 > s2
    const t2won = s2 > s1

    ;(m.team1Ids || []).forEach((id: string) => {
      if (!stats[id]) return
      stats[id].played++
      stats[id].pf += s1
      stats[id].pa += s2
      stats[id].pts += s1
      if (t1won) stats[id].won++
      else if (t2won) stats[id].lost++
    })
    ;(m.team2Ids || []).forEach((id: string) => {
      if (!stats[id]) return
      stats[id].played++
      stats[id].pf += s2
      stats[id].pa += s1
      stats[id].pts += s2
      if (t2won) stats[id].won++
      else if (t1won) stats[id].lost++
    })
  })

  return Object.values(stats).sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.won !== a.won ? b.won - a.won : b.pf - b.pa - (a.pf - a.pa),
  )
}

export const isMatchVisibleForPlayer = (
  match: NormalisedMatch,
  claimedId: string | null | undefined,
): boolean => {
  const claimedStr = claimedId ? String(claimedId) : null
  if (!claimedStr) return false
  return (
    (match.team1Ids || []).map(String).includes(claimedStr) ||
    (match.team2Ids || []).map(String).includes(claimedStr)
  )
}
