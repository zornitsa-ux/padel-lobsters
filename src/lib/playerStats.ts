// ─────────────────────────────────────────────────────────────────────────────
//  Per-player match stats, derived from the Supabase `matches` table.
//
//  This is the single source of truth shared between:
//    • Dashboard.jsx → "Your Stats" home card
//    • Players.jsx   → expanded profile (Rivalries & Chemistry, Match Metrics)
//
//  Keeping it in one place guarantees the home card and profile never
//  disagree about a player's played/won/lost/winRate, nemesis, or best
//  partner.
// ─────────────────────────────────────────────────────────────────────────────

export interface DbMatchForStats {
  completed?: boolean | null
  tournamentId: string | number
  team1Ids: (string | number)[]
  team2Ids: (string | number)[]
  score1?: string | number | null
  score2?: string | number | null
  round?: number | null
}

export interface TournamentForStats {
  id: string | number
  date?: string | null
}

type FormChar = 'W' | 'L' | 'D'

export interface H2HRecord {
  won: number
  lost: number
  draws: number
}

export interface PairRecord extends H2HRecord {
  ids: string[]
}

export interface PartnerRecord {
  wins: number
  losses: number
  games: number
}

export interface PlayerStats {
  played: number
  won: number
  lost: number
  draws: number
  points: number
  pointsFor: number
  pointsAgainst: number
  pointDiff: number
  avgPointsFor: number
  avgPointsAgainst: number
  winRate: number
  recentForm: FormChar[]
  bestWinStreak: number
  worstLossStreak: number
  h2h: Record<string, H2HRecord>
  h2hPairs: Record<string, PairRecord>
  partners: Record<string, PartnerRecord>
  playerTournaments: TournamentForStats[]
}

interface NormalisedEvent {
  tournamentId: string | number
  tournamentDate: string
  round: number
  myScore: number
  theirScore: number
  opponents: string[]
  teammates: string[]
}

/**
 * Compute a full per-player stats bundle.
 *
 * @param playerId
 * @param matches                DB matches (from Supabase `matches`)
 * @param tournaments            DB tournaments (for date lookup + chips)
 * @param _registrations         reserved — not currently used
 */
export function buildPlayerStats(
  playerId: string,
  matches: DbMatchForStats[] = [],
  tournaments: TournamentForStats[] = [],
  _registrations: unknown[] = [],
): PlayerStats {
  const events: NormalisedEvent[] = []

  // DB matches (from Supabase)
  const completed = (matches || []).filter((m) => m?.completed)
  completed.forEach((m) => {
    const onT1 = (m.team1Ids || []).includes(playerId)
    const onT2 = (m.team2Ids || []).includes(playerId)
    if (!onT1 && !onT2) return
    const tournDate = tournaments.find((t) => t.id === m.tournamentId)?.date || ''
    events.push({
      tournamentId: m.tournamentId,
      tournamentDate: tournDate,
      round: m.round || 0,
      myScore: parseInt(String(onT1 ? m.score1 : m.score2)) || 0,
      theirScore: parseInt(String(onT1 ? m.score2 : m.score1)) || 0,
      opponents: ((onT1 ? m.team2Ids : m.team1Ids) || []).filter(Boolean).map(String),
      teammates: ((onT1 ? m.team1Ids : m.team2Ids) || [])
        .filter((id) => id && String(id) !== playerId)
        .map(String),
    })
  })

  // Oldest first so streaks extend in real time.
  events.sort((a, b) => {
    const da = Date.parse(a.tournamentDate)
    const db = Date.parse(b.tournamentDate)
    if (!isNaN(da) && !isNaN(db) && da !== db) return da - db
    return (a.round || 0) - (b.round || 0)
  })

  let won = 0,
    lost = 0,
    draws = 0,
    pointsFor = 0,
    pointsAgainst = 0,
    points = 0
  let curWinStreak = 0,
    bestWinStreak = 0
  let curLossStreak = 0,
    worstLossStreak = 0
  const recentForm: FormChar[] = []
  const h2h: Record<string, H2HRecord> = {}
  const h2hPairs: Record<string, PairRecord> = {}
  const partners: Record<string, PartnerRecord> = {}
  const tournamentIds = new Set<string | number>()

  events.forEach((e) => {
    pointsFor += e.myScore
    pointsAgainst += e.theirScore
    points = pointsFor
    tournamentIds.add(e.tournamentId)

    let result: FormChar
    if (e.myScore > e.theirScore) {
      won++
      result = 'W'
      curWinStreak++
      bestWinStreak = Math.max(bestWinStreak, curWinStreak)
      curLossStreak = 0
    } else if (e.myScore < e.theirScore) {
      lost++
      result = 'L'
      curLossStreak++
      worstLossStreak = Math.max(worstLossStreak, curLossStreak)
      curWinStreak = 0
    } else {
      draws++
      result = 'D'
      curWinStreak = 0
      curLossStreak = 0
    }
    recentForm.push(result)

    e.opponents.forEach((oppId) => {
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

    e.teammates.forEach((tId) => {
      if (!tId) return
      if (!partners[tId]) partners[tId] = { wins: 0, losses: 0, games: 0 }
      partners[tId].games++
      if (result === 'W') partners[tId].wins++
      else if (result === 'L') partners[tId].losses++
    })
  })

  const playerTournaments = tournaments
    .filter((t) => tournamentIds.has(t.id))
    .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))

  const played = won + lost + draws

  return {
    played,
    won,
    lost,
    draws,
    points,
    pointsFor,
    pointsAgainst,
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
