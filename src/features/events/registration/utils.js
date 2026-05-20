const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

const byRegisteredAt = (a, b) => (a.registeredAt?.seconds || 0) - (b.registeredAt?.seconds || 0)

export const splitRegistrationsByStatus = (regs = []) => {
  const registered = regs.filter((r) => r.status === 'registered').sort(byRegisteredAt)
  const waitlisted = regs.filter((r) => r.status === 'waitlist').sort(byRegisteredAt)
  const cancelled = regs.filter((r) => r.status === 'cancelled')
  return { registered, waitlisted, cancelled }
}

export const getInTournamentPlayerIds = (regs = []) => {
  const registeredIds = regs.filter((r) => r.status === 'registered').map((r) => r.playerId)
  const waitlistedIds = regs.filter((r) => r.status === 'waitlist').map((r) => r.playerId)
  return { registeredIds, waitlistedIds, inTournamentIds: [...registeredIds, ...waitlistedIds] }
}

export const getAvailablePlayers = ({ players = [], regs = [], search = '' }) => {
  const q = String(search || '').toLowerCase()
  const { inTournamentIds } = getInTournamentPlayerIds(regs)
  return players
    .filter((p) => (p.status || 'active') === 'active')
    .filter((p) => !inTournamentIds.includes(p.id) && (p.name?.toLowerCase().includes(q) || !q))
}

export const computePaymentConfig = (tournament) => {
  const isAdminAll = !tournament?.courtBookingMode || tournament.courtBookingMode === 'admin_all'
  const hasTikkie = isAdminAll
    ? !!tournament?.tikkieLink
    : (tournament?.courts || []).some((c) => c.tikkieLink)
  const costPerPlayer = isAdminAll
    ? tournament?.totalPrice > 0
      ? tournament.totalPrice / (tournament.maxPlayers || 1)
      : 0
    : (tournament?.courts || []).reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0)

  return { isAdminAll, hasTikkie, costPerPlayer }
}

export const formatEventDate = (dateValue) => {
  if (!dateValue) return '—'
  return new Date(dateValue).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export const isWithinResultsWindow = (tournamentDate) => {
  if (!tournamentDate) return false
  const refMs = new Date(tournamentDate).getTime()
  if (Number.isNaN(refMs)) return false
  const elapsed = Date.now() - refMs
  return elapsed >= -TWO_DAYS_MS && elapsed < TWO_DAYS_MS
}

export const getPendingTransfersForTournament = (transfers = [], tournamentId) =>
  transfers.filter((t) => t.status === 'pending' && String(t.tournamentId) === String(tournamentId))

export const getPendingFromPlayer = (pendingTransfers = [], playerId) =>
  pendingTransfers.find((t) => playerId && String(t.fromPlayerId) === String(playerId))

export const getIncomingForPlayer = (pendingTransfers = [], playerId) =>
  pendingTransfers.filter((t) => playerId && String(t.toPlayerId) === String(playerId))

export const buildPendingByFromPlayerId = (pendingTransfers = []) =>
  new Map(pendingTransfers.map((t) => [String(t.fromPlayerId), t]))

const courtOrder = (label) => {
  const m = String(label ?? '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}

export const groupMatchesByRound = (matches = []) => {
  const byRound = {}
  matches.forEach((m) => {
    const r = m.round || 1
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(m)
  })

  Object.keys(byRound).forEach((r) => {
    byRound[r].sort((a, b) => courtOrder(a.court) - courtOrder(b.court))
  })

  return byRound
}

export const getSortedRoundNumbers = (byRound = {}) =>
  Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b)

export const getPlayerFirstName = (players = [], playerId) => {
  const p = players.find((x) => x.id === playerId)
  return p ? p.name.split(' ')[0] : '?'
}

export const computeRankings = ({ matches = [], regs = [], players = [] }) => {
  const registeredRegs = regs.filter((r) => r.status === 'registered')
  const regPlayerIds = registeredRegs.map((r) => r.playerId)

  const stats = {}
  regPlayerIds.forEach((id) => {
    const p = players.find((x) => x.id === id)
    if (p) stats[id] = { player: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, pts: 0 }
  })

  matches
    .filter((m) => m.completed && m.score1 != null && m.score2 != null)
    .forEach((m) => {
      const s1 = m.score1
      const s2 = m.score2
      const t1won = s1 > s2
      const t2won = s2 > s1

      ;(m.team1Ids || []).forEach((id) => {
        if (!stats[id]) return
        stats[id].played++
        stats[id].pf += s1
        stats[id].pa += s2
        stats[id].pts += s1
        if (t1won) stats[id].won++
        else if (t2won) stats[id].lost++
      })
      ;(m.team2Ids || []).forEach((id) => {
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

export const isMatchVisibleForPlayer = (match, claimedId) => {
  const claimedStr = claimedId ? String(claimedId) : null
  if (!claimedStr) return false
  return (
    (match.team1Ids || []).map(String).includes(claimedStr) ||
    (match.team2Ids || []).map(String).includes(claimedStr)
  )
}
