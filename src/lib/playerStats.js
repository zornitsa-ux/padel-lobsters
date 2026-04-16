// ─────────────────────────────────────────────────────────────────────────────
//  Per-player match stats, derived from the Supabase `matches` table AND
//  (optionally) the hardcoded historical TOURNAMENTS list in History.jsx.
//
//  This is the single source of truth shared between:
//    • Dashboard.jsx → "Your Stats" home card
//    • Players.jsx   → expanded profile (Rivalries & Chemistry, Match Metrics)
//
//  Keeping it in one place guarantees the home card and profile never
//  disagree about a player's played/won/lost/winRate, nemesis, or best
//  partner — which was the bug before: home read DB only, profile read
//  DB + history.
// ─────────────────────────────────────────────────────────────────────────────

// Normalise a name for alias/first-name matching: lowercase + strip
// whitespace and common punctuation so "Gonzalo U" ≈ "gonzalou".
function normHistName(s) {
  return String(s || '').toLowerCase().replace(/[\s.\-_]/g, '')
}

/**
 * Compute a full per-player stats bundle.
 *
 * @param {string} playerId
 * @param {Array}  matches                DB matches (from Supabase `matches`)
 * @param {Array}  tournaments            DB tournaments (for date lookup + chips)
 * @param {Array}  registrations          (reserved — not currently used but
 *                                        kept for future per-registration stats)
 * @param {Array}  players                Live players list — used for the
 *                                        name→id fallback when no alias is set.
 * @param {Object} aliasMap               { historicalName: playerId }
 * @param {Array}  historicalTournaments  TOURNAMENTS export from History.jsx
 *
 * @returns stats bundle with played, won, lost, draws, winRate,
 *          pointsFor/Against, pointDiff, streaks, h2h, h2hPairs,
 *          partners, playerTournaments (DB only).
 */
export function buildPlayerStats(
  playerId,
  matches = [],
  tournaments = [],
  // eslint-disable-next-line no-unused-vars
  registrations = [],
  players = [],
  aliasMap = {},
  historicalTournaments = [],
) {
  // ── Name → player_id resolver for historical matches ─────────────────
  // Priority: explicit alias map entries, then fall back to matching a
  // live player's first-name or full-name. Unresolved opponent/partner
  // names are skipped from h2h / partner rows (so you don't get
  // "You vs <unknown>" junk), but the focal player's own pointsFor /
  // pointsAgainst / streaks still count so long as *they* resolve.
  const nameToId = new Map()
  Object.entries(aliasMap || {}).forEach(([name, pid]) => {
    if (name && pid) nameToId.set(normHistName(name), pid)
  })
  players.forEach(pl => {
    if (!pl?.id || !pl?.name) return
    const first = normHistName(String(pl.name).split(' ')[0])
    const full  = normHistName(pl.name)
    if (first && !nameToId.has(first)) nameToId.set(first, pl.id)
    if (full  && !nameToId.has(full))  nameToId.set(full,  pl.id)
  })
  const resolveName = (n) => nameToId.get(normHistName(n)) || null

  // ── Unified match list: DB matches + historical matches ──────────────
  // Each event is normalised into the same shape so a single loop below
  // can handle both sources identically. Streaks end up correct because
  // we sort chronologically before iterating.
  const events = []

  // DB matches (from Supabase)
  const completed = (matches || []).filter(m => m?.completed)
  completed.forEach(m => {
    const onT1 = (m.team1Ids || []).includes(playerId)
    const onT2 = (m.team2Ids || []).includes(playerId)
    if (!onT1 && !onT2) return
    const tournDate = tournaments.find(t => t.id === m.tournamentId)?.date || ''
    events.push({
      source: 'db',
      tournamentId: m.tournamentId,
      tournamentDate: tournDate,
      round: m.round || 0,
      myScore: parseInt(onT1 ? m.score1 : m.score2) || 0,
      theirScore: parseInt(onT1 ? m.score2 : m.score1) || 0,
      opponents: (onT1 ? (m.team2Ids || []) : (m.team1Ids || [])).filter(Boolean),
      teammates: (onT1 ? (m.team1Ids || []) : (m.team2Ids || []))
        .filter(id => id && id !== playerId),
    })
  })

  // Historical matches (from the hardcoded TOURNAMENTS list in History.jsx)
  ;(historicalTournaments || []).forEach(t => {
    if (!t?.rounds) return
    t.rounds.forEach(r => {
      (r.matches || []).forEach(m => {
        const t1Ids = (m.t1 || []).map(resolveName)
        const t2Ids = (m.t2 || []).map(resolveName)
        const onT1 = t1Ids.includes(playerId)
        const onT2 = t2Ids.includes(playerId)
        if (!onT1 && !onT2) return
        events.push({
          source: 'hist',
          tournamentId: `hist:${t.id}`,
          tournamentDate: t.date || '',
          round: r.round || 0,
          myScore: parseInt(onT1 ? m.s1 : m.s2) || 0,
          theirScore: parseInt(onT1 ? m.s2 : m.s1) || 0,
          opponents: (onT1 ? t2Ids : t1Ids).filter(Boolean),
          teammates: (onT1 ? t1Ids : t2Ids).filter(id => id && id !== playerId),
        })
      })
    })
  })

  // Chronological sort — oldest first — so streaks extend in real time.
  // Historical tournaments generally predate DB ones (Dec 2025 → present),
  // but we compare on parsed date anyway and fall back to a source tiebreak
  // (hist before db) for unparseable dates like "March 2026".
  events.sort((a, b) => {
    const da = Date.parse(a.tournamentDate)
    const db = Date.parse(b.tournamentDate)
    if (!isNaN(da) && !isNaN(db) && da !== db) return da - db
    if (a.source !== b.source) return a.source === 'hist' ? -1 : 1
    return (a.round || 0) - (b.round || 0)
  })

  let won = 0, lost = 0, draws = 0, pointsFor = 0, pointsAgainst = 0, points = 0
  let curWinStreak = 0, bestWinStreak = 0
  let curLossStreak = 0, worstLossStreak = 0
  const recentForm = []         // last 5: 'W' | 'L' | 'D'
  const h2h = {}                // opponentId → { won, lost, draws }
  const h2hPairs = {}           // "id1:id2" → { ids: [id1,id2], won, lost, draws }
  const partners = {}           // partnerId → { wins, losses, games }
  const tournamentIds = new Set()

  events.forEach(e => {
    pointsFor += e.myScore
    pointsAgainst += e.theirScore
    points = pointsFor
    tournamentIds.add(e.tournamentId)

    let result
    if (e.myScore > e.theirScore) {
      won++; result = 'W'
      curWinStreak++; bestWinStreak = Math.max(bestWinStreak, curWinStreak)
      curLossStreak = 0
    } else if (e.myScore < e.theirScore) {
      lost++; result = 'L'
      curLossStreak++; worstLossStreak = Math.max(worstLossStreak, curLossStreak)
      curWinStreak = 0
    } else {
      draws++; result = 'D'
      curWinStreak = 0; curLossStreak = 0
    }
    recentForm.push(result)

    e.opponents.forEach(oppId => {
      if (!oppId) return
      if (!h2h[oppId]) h2h[oppId] = { won: 0, lost: 0, draws: 0 }
      if (result === 'W') h2h[oppId].won++
      else if (result === 'L') h2h[oppId].lost++
      else h2h[oppId].draws++
    })

    // Pair-level h2h — only counted when both opponents resolve, so
    // partial pairs don't produce misleading "you vs X+unknown" rows.
    const pairIds = [...e.opponents].filter(Boolean).sort()
    if (pairIds.length === 2) {
      const pairKey = pairIds.join(':')
      if (!h2hPairs[pairKey]) h2hPairs[pairKey] = { ids: pairIds, won: 0, lost: 0, draws: 0 }
      if (result === 'W') h2hPairs[pairKey].won++
      else if (result === 'L') h2hPairs[pairKey].lost++
      else h2hPairs[pairKey].draws++
    }

    e.teammates.forEach(tId => {
      if (!tId) return
      if (!partners[tId]) partners[tId] = { wins: 0, losses: 0, games: 0 }
      partners[tId].games++
      if (result === 'W') partners[tId].wins++
      else if (result === 'L') partners[tId].losses++
    })
  })

  // DB-only tournament list for the "Past tournaments" chip row — the
  // profile already has a dedicated Historical section powered by
  // buildHistoricalAppearances, so we don't want to duplicate those here.
  const dbTournIds = new Set(
    Array.from(tournamentIds).filter(id => !String(id).startsWith('hist:'))
  )
  const playerTournaments = tournaments
    .filter(t => dbTournIds.has(t.id))
    .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)

  const played = won + lost + draws

  return {
    played,
    won, lost, draws, points,
    pointsFor, pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
    avgPointsFor: played > 0 ? pointsFor / played : 0,
    avgPointsAgainst: played > 0 ? pointsAgainst / played : 0,
    winRate: played > 0 ? Math.round((won / played) * 100) : 0,
    recentForm: recentForm.slice(-5),
    bestWinStreak,
    worstLossStreak,
    h2h,
    h2hPairs,
    partners,
    playerTournaments,
  }
}
