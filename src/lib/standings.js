// ─────────────────────────────────────────────────────────────────────────────
//  Single source of truth for tournament standings (Americano format).
//
//  Sort order — must match what Scores.jsx displays to players:
//    1. Total game points (descending)
//    2. Matches won (descending)
//    3. Head-to-head (who beat whom more often)
//
//  Used by:
//    - Scores.jsx   (official standings shown to users)
//    - Players.jsx  (Lobster Review per-tournament ranks)
//
//  Keeping a single helper here prevents the review from claiming a rank
//  that disagrees with the Scores tab.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute ranked standings for a tournament.
 *
 * @param {string|number} tournamentId
 * @param {Array} matches            all matches across all tournaments
 * @param {Array<string>=} playerIds optional list of player IDs to seed the
 *                                    standings (so players who registered but
 *                                    didn't play still appear). If omitted,
 *                                    the standings are derived from the match
 *                                    roster alone.
 * @returns {Array<{ id, played, won, lost, points, pointsFor, pointsAgainst }>}
 *          sorted best → worst.
 */
export function computeTournamentStandings(tournamentId, matches, playerIds = null) {
  const tMs = (matches || []).filter(m =>
    String(m.tournamentId) === String(tournamentId) && m.completed
  )
  if (tMs.length === 0) return []

  const idsFromMatches = new Set()
  tMs.forEach(m => {
    ;(m.team1Ids || []).forEach(id => idsFromMatches.add(String(id)))
    ;(m.team2Ids || []).forEach(id => idsFromMatches.add(String(id)))
  })
  const allIds = playerIds
    ? [...new Set([...playerIds.map(String), ...idsFromMatches])]
    : [...idsFromMatches]

  const stats = {}
  allIds.forEach(id => {
    stats[id] = {
      id,
      played: 0, won: 0, lost: 0,
      pointsFor: 0, pointsAgainst: 0,
      points: 0,
    }
  })

  tMs.forEach(m => {
    const s1 = parseInt(m.score1) || 0
    const s2 = parseInt(m.score2) || 0
    const t1Won = s1 > s2
    const t2Won = s2 > s1

    ;(m.team1Ids || []).forEach(id => {
      const s = stats[String(id)]
      if (!s) return
      s.played++
      s.pointsFor    += s1
      s.pointsAgainst += s2
      s.points       += s1
      if (t1Won) s.won++
      else if (t2Won) s.lost++
    })
    ;(m.team2Ids || []).forEach(id => {
      const s = stats[String(id)]
      if (!s) return
      s.played++
      s.pointsFor    += s2
      s.pointsAgainst += s1
      s.points       += s2
      if (t2Won) s.won++
      else if (t1Won) s.lost++
    })
  })

  // Head-to-head lookup for tiebreaks.
  const h2h = {}
  tMs.forEach(m => {
    const s1 = parseInt(m.score1) || 0
    const s2 = parseInt(m.score2) || 0
    if (s1 === s2) return
    const winners = s1 > s2 ? (m.team1Ids || []) : (m.team2Ids || [])
    const losers  = s1 > s2 ? (m.team2Ids || []) : (m.team1Ids || [])
    winners.forEach(w => losers.forEach(l => {
      const key = `${w}:${l}`
      h2h[key] = (h2h[key] || 0) + 1
    }))
  })

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points   // 1. Total game points
    if (b.won    !== a.won)    return b.won - a.won         // 2. Matches won
    const aBeatsB = h2h[`${a.id}:${b.id}`] || 0             // 3. Head-to-head
    const bBeatsA = h2h[`${b.id}:${a.id}`] || 0
    return bBeatsA - aBeatsB
  })
}

/**
 * Convenience wrapper: return 1-based rank for a specific player in a
 * given tournament, or null if they didn't play / don't appear.
 */
export function rankOfPlayer(playerId, tournamentId, matches, playerIds = null) {
  const standings = computeTournamentStandings(tournamentId, matches, playerIds)
  if (standings.length === 0) return null
  const pos = standings.findIndex(s => String(s.id) === String(playerId))
  return pos >= 0
    ? { rank: pos + 1, total: standings.length }
    : null
}
