// ─────────────────────────────────────────────────────────────────────────────
//  Historical-tournament stats derived from the alias map + hardcoded
//  TOURNAMENTS list in src/components/History.jsx.
//
//  The alias map is { historical_name: player_id }. For any given player,
//  collect every name that resolves to them, then walk the tournaments to
//  derive: appearances, ranks, total points, podium count, match W-L from
//  the rounds data, and best finish.
// ─────────────────────────────────────────────────────────────────────────────

import { TOURNAMENTS } from '../components/History'

/** Lower-case + strip whitespace/punctuation for forgiving comparisons. */
export function normaliseName(n) {
  return String(n || '').toLowerCase().replace(/[\s.\-_]/g, '')
}

/** Collect every unique historical name across all tournaments + rounds. */
export function getAllHistoricalNames() {
  const names = new Set()
  TOURNAMENTS.forEach(t => {
    t.players?.forEach(p => names.add(p.name))
    t.rounds?.forEach(r => r.matches?.forEach(m => {
      m.t1?.forEach(n => names.add(n))
      m.t2?.forEach(n => names.add(n))
    }))
  })
  return [...names].sort((a, b) => a.localeCompare(b))
}

/**
 * Given an alias map and a player_id, return the set of historical names
 * (raw + normalised) that resolve to this player.
 */
function namesForPlayer(playerId, aliasMap) {
  const raw = Object.entries(aliasMap || {})
    .filter(([, pid]) => pid === playerId)
    .map(([name]) => name)
  return {
    raw: new Set(raw),
    norm: new Set(raw.map(normaliseName)),
  }
}

/**
 * Build a per-tournament appearance record for one player from the
 * hardcoded history. Returns an array sorted newest first.
 *
 *   [{ id, name, date, type, rank, total, played, won, lost, draws,
 *      pointsFor, pointsAgainst, isPodium }]
 */
/**
 * Build the effective ranking for a tournament. Players sort by total
 * (desc), but any entry with an explicit `podium` field (1, 2, or 3) is
 * pinned to that final position — overriding the tiebreaker. Non-podium
 * players fill in the remaining slots in sort order.
 *
 * This lets us record real-world podium results when ties on total points
 * would otherwise resolve incorrectly via input order.
 */
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.total - a.total)
  const withPodium = sorted.filter(p => p.podium >= 1 && p.podium <= 3)
  const others = sorted.filter(p => !(p.podium >= 1 && p.podium <= 3))

  const ranked = new Array(sorted.length)
  withPodium.forEach(p => { ranked[p.podium - 1] = p })

  let oi = 0
  for (let i = 0; i < ranked.length; i++) {
    if (!ranked[i]) ranked[i] = others[oi++]
  }
  return ranked
}

export function buildHistoricalAppearances(playerId, aliasMap) {
  if (!playerId) return []
  const { norm } = namesForPlayer(playerId, aliasMap)
  if (norm.size === 0) return []

  const out = []

  TOURNAMENTS.forEach(t => {
    const players = t.players || []
    if (players.length === 0) return

    // Find this player's row in standings (if present), respecting any
    // explicit podium overrides that pin actual finish positions.
    const ranked = rankPlayers(players)
    const idx = ranked.findIndex(p => norm.has(normaliseName(p.name)))
    if (idx < 0) return

    const me = ranked[idx]

    // Walk rounds for W/L/D + point differential
    let played = 0, won = 0, lost = 0, draws = 0, pf = 0, pa = 0
    ;(t.rounds || []).forEach(r => {
      r.matches?.forEach(m => {
        const onT1 = (m.t1 || []).some(n => norm.has(normaliseName(n)))
        const onT2 = (m.t2 || []).some(n => norm.has(normaliseName(n)))
        if (!onT1 && !onT2) return
        const myScore    = onT1 ? m.s1 : m.s2
        const theirScore = onT1 ? m.s2 : m.s1
        played++
        pf += myScore
        pa += theirScore
        if (myScore > theirScore) won++
        else if (myScore < theirScore) lost++
        else draws++
      })
    })

    out.push({
      id:         t.id,
      name:       t.name,
      date:       t.date,
      type:       t.type,
      rank:       idx + 1,
      total:      me.total,
      players:    players.length,
      played, won, lost, draws,
      pointsFor:  pf,
      pointsAgainst: pa,
      isPodium:   idx < 3,
    })
  })

  // Newest first — try Date parse, fall back to string compare so things
  // like "December 2025" still order sensibly relative to "2026-04-10".
  return out.sort((a, b) => {
    const ta = Date.parse(a.date), tb = Date.parse(b.date)
    if (!isNaN(ta) && !isNaN(tb)) return tb - ta
    return String(b.date).localeCompare(String(a.date))
  })
}

/**
 * Roll appearances up into headline stats for the profile chip row.
 *   { tournaments, podiums, golds, totalPoints, played, won, lost, winRate,
 *     bestRank, bestRankTournamentName }
 */
export function summariseAppearances(appearances) {
  const out = {
    tournaments: appearances.length,
    podiums: 0,
    golds: 0,
    silvers: 0,
    bronzes: 0,
    totalPoints: 0,
    played: 0, won: 0, lost: 0, draws: 0,
    winRate: 0,
    bestRank: null,
    bestRankTournamentName: null,
  }
  appearances.forEach(a => {
    if (a.rank === 1) out.golds++
    if (a.rank === 2) out.silvers++
    if (a.rank === 3) out.bronzes++
    if (a.isPodium)   out.podiums++
    out.totalPoints += a.total || 0
    out.played      += a.played
    out.won         += a.won
    out.lost        += a.lost
    out.draws       += a.draws
    if (out.bestRank === null || a.rank < out.bestRank) {
      out.bestRank = a.rank
      out.bestRankTournamentName = a.name
    }
  })
  const decided = out.won + out.lost + out.draws
  out.winRate = decided > 0 ? Math.round((out.won / decided) * 100) : 0
  return out
}

/**
 * For the matcher UI: list every historical name with its current alias
 * status + a count of which tournaments it appears in.
 *   [{ name, playerId|null, tournamentCount, tournamentLabels }]
 */
export function buildAliasInventory(aliasMap) {
  const inventory = []
  const all = getAllHistoricalNames()

  all.forEach(name => {
    const norm = normaliseName(name)
    const tournaments = []
    TOURNAMENTS.forEach(t => {
      const inStandings = (t.players || []).some(p => normaliseName(p.name) === norm)
      const inRounds = (t.rounds || []).some(r =>
        r.matches?.some(m =>
          (m.t1 || []).some(n => normaliseName(n) === norm) ||
          (m.t2 || []).some(n => normaliseName(n) === norm)
        )
      )
      if (inStandings || inRounds) {
        tournaments.push(t.name.replace('Lobster Tournament · ', ''))
      }
    })
    inventory.push({
      name,
      playerId:         aliasMap?.[name] || null,
      skipped:          aliasMap?.[name] === '__not_in_roster__',
      tournamentCount:  tournaments.length,
      tournamentLabels: tournaments,
    })
  })

  return inventory
}

/** Sentinel value stored when admin marks a name as "Not in roster". */
export const NOT_IN_ROSTER = '__not_in_roster__'

/**
 * Suggest current players whose names are similar to a historical name.
 * Returns a list of player objects sorted by best match first.
 */
export function suggestPlayers(historicalName, players, max = 4) {
  const target = normaliseName(historicalName)
  const tokens = String(historicalName).toLowerCase().split(/\s+/)
  const firstTok = tokens[0]

  const scored = (players || []).map(p => {
    const full   = normaliseName(p.name)
    const first  = String(p.name || '').toLowerCase().split(/\s+/)[0]
    let score = 0
    if (full === target) score = 1000
    else if (full.startsWith(target) || target.startsWith(full)) score = 500
    else if (full.includes(target) || target.includes(full)) score = 300
    else if (first === firstTok) score = 200
    else if (first.startsWith(firstTok) || firstTok.startsWith(first)) score = 100
    // surname-initial suffix: "Alex M" matches "Alex Martinez"
    if (tokens.length > 1 && tokens[1].length === 1) {
      const last = String(p.name || '').toLowerCase().split(/\s+/).slice(-1)[0]
      if (first === firstTok && last && last[0] === tokens[1]) score += 400
    }
    return { player: p, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(s => s.player)
}
