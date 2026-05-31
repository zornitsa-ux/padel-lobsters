import { describe, expect, it } from 'vitest'
import { buildPlayerStats } from './playerStats'

// ─── Factories ────────────────────────────────────────────────────────────────

function dbMatch(overrides: Record<string, unknown> = {}) {
  return {
    completed: true,
    tournamentId: 't1',
    team1Ids: ['p1', 'p2'],
    team2Ids: ['p3', 'p4'],
    score1: 0,
    score2: 0,
    round: 1,
    ...overrides,
  }
}

function histTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    date: '2025-06-01',
    rounds: [],
    ...overrides,
  }
}

function histMatch(t1: string[], t2: string[], s1: number, s2: number) {
  return { t1, t2, s1, s2 }
}

const T1 = { id: 't1', date: '2026-03-01' }
const T2 = { id: 't2', date: '2026-04-01' }

// ─── Empty inputs ─────────────────────────────────────────────────────────────

describe('buildPlayerStats — empty inputs', () => {
  const s = buildPlayerStats('p1')

  it('played is 0', () => expect(s.played).toBe(0))
  it('won is 0', () => expect(s.won).toBe(0))
  it('lost is 0', () => expect(s.lost).toBe(0))
  it('draws is 0', () => expect(s.draws).toBe(0))
  it('points is 0', () => expect(s.points).toBe(0))
  it('pointsFor is 0', () => expect(s.pointsFor).toBe(0))
  it('pointsAgainst is 0', () => expect(s.pointsAgainst).toBe(0))
  it('pointDiff is 0', () => expect(s.pointDiff).toBe(0))
  it('winRate is 0', () => expect(s.winRate).toBe(0))
  it('avgPointsFor is 0', () => expect(s.avgPointsFor).toBe(0))
  it('avgPointsAgainst is 0', () => expect(s.avgPointsAgainst).toBe(0))
  it('recentForm is []', () => expect(s.recentForm).toEqual([]))
  it('bestWinStreak is 0', () => expect(s.bestWinStreak).toBe(0))
  it('worstLossStreak is 0', () => expect(s.worstLossStreak).toBe(0))
  it('h2h is {}', () => expect(s.h2h).toEqual({}))
  it('h2hPairs is {}', () => expect(s.h2hPairs).toEqual({}))
  it('partners is {}', () => expect(s.partners).toEqual({}))
  it('playerTournaments is []', () => expect(s.playerTournaments).toEqual([]))
})

// ─── Win / loss / draw ────────────────────────────────────────────────────────

describe('buildPlayerStats — win/loss/draw counting', () => {
  it('counts a win when player is on team1', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    expect(s.won).toBe(1)
    expect(s.lost).toBe(0)
    expect(s.draws).toBe(0)
    expect(s.played).toBe(1)
  })

  it('counts a win when player is on team2', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 3, score2: 7 })
    const s = buildPlayerStats('p3', [m])
    expect(s.won).toBe(1)
    expect(s.lost).toBe(0)
  })

  it('counts a loss when player is on team1', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 3, score2: 7 })
    const s = buildPlayerStats('p1', [m])
    expect(s.won).toBe(0)
    expect(s.lost).toBe(1)
  })

  it('counts a draw when scores are equal', () => {
    const m = dbMatch({ score1: 5, score2: 5 })
    const s = buildPlayerStats('p1', [m])
    expect(s.draws).toBe(1)
    expect(s.won).toBe(0)
    expect(s.lost).toBe(0)
  })

  it('ignores incomplete matches', () => {
    const m = dbMatch({ completed: false, score1: 6, score2: 4 })
    expect(buildPlayerStats('p1', [m]).played).toBe(0)
  })

  it('ignores matches where player is on neither team', () => {
    const m = dbMatch({ team1Ids: ['p2', 'p3'], team2Ids: ['p4', 'p5'], score1: 6, score2: 4 })
    expect(buildPlayerStats('p1', [m]).played).toBe(0)
  })

  it('accumulates wins across multiple matches', () => {
    const m1 = dbMatch({ score1: 7, score2: 3 })
    const m2 = dbMatch({ score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m1, m2])
    expect(s.won).toBe(2)
    expect(s.played).toBe(2)
  })

  it('accepts string scores', () => {
    const m = dbMatch({ score1: '7', score2: '3' })
    const s = buildPlayerStats('p1', [m])
    expect(s.pointsFor).toBe(7)
  })
})

// ─── Points ───────────────────────────────────────────────────────────────────

describe('buildPlayerStats — points', () => {
  it('pointsFor comes from score1 for team1', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 7, score2: 3 })
    const s = buildPlayerStats('p1', [m])
    expect(s.pointsFor).toBe(7)
    expect(s.pointsAgainst).toBe(3)
  })

  it('pointsFor comes from score2 for team2', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 7, score2: 3 })
    const s = buildPlayerStats('p3', [m])
    expect(s.pointsFor).toBe(3)
    expect(s.pointsAgainst).toBe(7)
  })

  it('pointDiff is pointsFor minus pointsAgainst', () => {
    const m = dbMatch({ score1: 8, score2: 2 })
    const s = buildPlayerStats('p1', [m])
    expect(s.pointDiff).toBe(6)
  })

  it('points equals pointsFor', () => {
    const m = dbMatch({ score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    expect(s.points).toBe(s.pointsFor)
  })

  it('computes avgPointsFor over multiple matches', () => {
    const m1 = dbMatch({ score1: 6, score2: 4 })
    const m2 = dbMatch({ score1: 8, score2: 2 })
    const s = buildPlayerStats('p1', [m1, m2])
    expect(s.avgPointsFor).toBe(7)
  })

  it('computes avgPointsAgainst over multiple matches', () => {
    const m1 = dbMatch({ score1: 6, score2: 4 })
    const m2 = dbMatch({ score1: 8, score2: 2 })
    const s = buildPlayerStats('p1', [m1, m2])
    expect(s.avgPointsAgainst).toBe(3)
  })
})

// ─── Win rate ─────────────────────────────────────────────────────────────────

describe('buildPlayerStats — winRate', () => {
  it('is 100 when all matches are wins', () => {
    const m = dbMatch({ score1: 6, score2: 4 })
    expect(buildPlayerStats('p1', [m]).winRate).toBe(100)
  })

  it('is 0 when all matches are losses', () => {
    const m = dbMatch({ score1: 3, score2: 7 })
    expect(buildPlayerStats('p1', [m]).winRate).toBe(0)
  })

  it('is rounded to nearest integer', () => {
    // 1 win out of 3 = 33.33% → rounds to 33
    const m1 = dbMatch({ score1: 6, score2: 4 })
    const m2 = dbMatch({ score1: 3, score2: 7 })
    const m3 = dbMatch({ score1: 3, score2: 7 })
    expect(buildPlayerStats('p1', [m1, m2, m3]).winRate).toBe(33)
  })
})

// ─── Streaks ──────────────────────────────────────────────────────────────────

describe('buildPlayerStats — streaks', () => {
  it('tracks bestWinStreak', () => {
    const win = dbMatch({ score1: 7, score2: 3 })
    const loss = dbMatch({ score1: 3, score2: 7 })
    // W W L W W W → bestWinStreak = 3
    const s = buildPlayerStats('p1', [win, win, loss, win, win, win])
    expect(s.bestWinStreak).toBe(3)
  })

  it('tracks worstLossStreak', () => {
    const win = dbMatch({ score1: 7, score2: 3 })
    const loss = dbMatch({ score1: 3, score2: 7 })
    // L L W L → worstLossStreak = 2
    const s = buildPlayerStats('p1', [loss, loss, win, loss])
    expect(s.worstLossStreak).toBe(2)
  })

  it('a draw resets both streaks', () => {
    const win = dbMatch({ score1: 7, score2: 3 })
    const draw = dbMatch({ score1: 5, score2: 5 })
    // W W D W → bestWinStreak = 2 (reset by draw)
    const s = buildPlayerStats('p1', [win, win, draw, win])
    expect(s.bestWinStreak).toBe(2)
  })
})

// ─── recentForm ───────────────────────────────────────────────────────────────

describe('buildPlayerStats — recentForm', () => {
  it('returns W/L/D for each result', () => {
    const win = dbMatch({ score1: 7, score2: 3 })
    const loss = dbMatch({ score1: 3, score2: 7 })
    const draw = dbMatch({ score1: 5, score2: 5 })
    const s = buildPlayerStats('p1', [win, loss, draw])
    expect(s.recentForm).toEqual(['W', 'L', 'D'])
  })

  it('caps at the last 5 results', () => {
    const win = dbMatch({ score1: 7, score2: 3 })
    const loss = dbMatch({ score1: 3, score2: 7 })
    // 6 matches; last 5 should be W W W W W (the 5 wins)
    const s = buildPlayerStats('p1', [loss, win, win, win, win, win])
    expect(s.recentForm).toHaveLength(5)
    expect(s.recentForm).toEqual(['W', 'W', 'W', 'W', 'W'])
  })

  it('returns fewer than 5 when player has played fewer matches', () => {
    const win = dbMatch({ score1: 7, score2: 3 })
    expect(buildPlayerStats('p1', [win]).recentForm).toHaveLength(1)
  })
})

// ─── h2h ─────────────────────────────────────────────────────────────────────

describe('buildPlayerStats — h2h', () => {
  it('records a win against each individual opponent', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    expect(s.h2h['p3']).toEqual({ won: 1, lost: 0, draws: 0 })
    expect(s.h2h['p4']).toEqual({ won: 1, lost: 0, draws: 0 })
  })

  it('records a loss against each individual opponent', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 3, score2: 7 })
    const s = buildPlayerStats('p1', [m])
    expect(s.h2h['p3']).toEqual({ won: 0, lost: 1, draws: 0 })
  })

  it('accumulates across multiple matches against the same opponent', () => {
    const win = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 6, score2: 4 })
    const loss = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 3, score2: 7 })
    const s = buildPlayerStats('p1', [win, loss])
    expect(s.h2h['p3']).toEqual({ won: 1, lost: 1, draws: 0 })
  })

  it('does not include the player themselves in h2h', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    expect(s.h2h['p1']).toBeUndefined()
  })
})

// ─── h2hPairs ────────────────────────────────────────────────────────────────

describe('buildPlayerStats — h2hPairs', () => {
  it('records result against the full opponent pair', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    const key = 'p3:p4'
    expect(s.h2hPairs[key]).toEqual({ ids: ['p3', 'p4'], won: 1, lost: 0, draws: 0 })
  })

  it('key is always sorted so p3:p4 and p4:p3 merge', () => {
    // opponents arrive as ['p4','p3'] in the match
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p4', 'p3'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    expect(s.h2hPairs['p3:p4']).toBeDefined()
    expect(s.h2hPairs['p4:p3']).toBeUndefined()
  })

  it('skips when there is only 1 opponent (solo match)', () => {
    const m = dbMatch({ team1Ids: ['p1'], team2Ids: ['p3'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m])
    expect(Object.keys(s.h2hPairs)).toHaveLength(0)
  })
})

// ─── partners ────────────────────────────────────────────────────────────────

describe('buildPlayerStats — partners', () => {
  it('records wins and games with each teammate', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 7, score2: 3 })
    const s = buildPlayerStats('p1', [m])
    expect(s.partners['p2']).toEqual({ wins: 1, losses: 0, games: 1 })
  })

  it('records losses with each teammate', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 3, score2: 7 })
    const s = buildPlayerStats('p1', [m])
    expect(s.partners['p2']).toEqual({ wins: 0, losses: 1, games: 1 })
  })

  it('does not include the player themselves as a partner', () => {
    const m = dbMatch({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 7, score2: 3 })
    const s = buildPlayerStats('p1', [m])
    expect(s.partners['p1']).toBeUndefined()
  })

  it('accumulates across multiple matches with the same partner', () => {
    const win = dbMatch({ team1Ids: ['p1', 'p2'], score1: 7, score2: 3 })
    const loss = dbMatch({ team1Ids: ['p1', 'p2'], score1: 3, score2: 7 })
    const s = buildPlayerStats('p1', [win, loss])
    expect(s.partners['p2']).toEqual({ wins: 1, losses: 1, games: 2 })
  })
})

// ─── playerTournaments ───────────────────────────────────────────────────────

describe('buildPlayerStats — playerTournaments', () => {
  it('includes tournaments where the player played at least one match', () => {
    const m = dbMatch({ tournamentId: 't1', team1Ids: ['p1', 'p2'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m], [T1])
    expect(s.playerTournaments.map((t) => t.id)).toContain('t1')
  })

  it('excludes tournaments where the player had no matches', () => {
    const m = dbMatch({ tournamentId: 't1', team1Ids: ['p1', 'p2'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m], [T1, T2])
    expect(s.playerTournaments.map((t) => t.id)).not.toContain('t2')
  })

  it('sorts by date descending (newest first)', () => {
    const m1 = dbMatch({ tournamentId: 't1', team1Ids: ['p1'], score1: 6, score2: 4 })
    const m2 = dbMatch({ tournamentId: 't2', team1Ids: ['p1'], score1: 6, score2: 4 })
    const s = buildPlayerStats('p1', [m1, m2], [T1, T2])
    expect(s.playerTournaments[0].id).toBe('t2') // T2 is newer (April)
    expect(s.playerTournaments[1].id).toBe('t1')
  })

  it('excludes historical (hist:) tournament ids', () => {
    const hist = histTournament({
      rounds: [{ round: 1, matches: [histMatch(['Alice'], ['Bob'], 6, 4)] }],
    })
    const s = buildPlayerStats('p1', [], [T1], [], [{ id: 'p1', name: 'Alice' }], {}, [hist])
    // The hist tournament should not appear in playerTournaments
    const ids = s.playerTournaments.map((t) => t.id)
    expect(ids.every((id) => !String(id).startsWith('hist:'))).toBe(true)
  })
})

// ─── Historical matches ───────────────────────────────────────────────────────

describe('buildPlayerStats — historical matches', () => {
  it('counts a win from a historical match via aliasMap', () => {
    const hist = histTournament({
      rounds: [{ round: 1, matches: [histMatch(['Alice', 'Bob'], ['Carol', 'Dave'], 7, 3)] }],
    })
    const aliasMap = { Alice: 'p1', Bob: 'p2', Carol: 'p3', Dave: 'p4' }
    const s = buildPlayerStats('p1', [], [], [], [], aliasMap, [hist])
    expect(s.won).toBe(1)
    expect(s.played).toBe(1)
  })

  it('counts a loss from a historical match', () => {
    const hist = histTournament({
      rounds: [{ round: 1, matches: [histMatch(['Alice', 'Bob'], ['Carol', 'Dave'], 3, 7)] }],
    })
    const aliasMap = { Alice: 'p1', Bob: 'p2', Carol: 'p3', Dave: 'p4' }
    const s = buildPlayerStats('p1', [], [], [], [], aliasMap, [hist])
    expect(s.lost).toBe(1)
  })

  it('resolves player by first name when not in aliasMap', () => {
    const hist = histTournament({
      rounds: [{ round: 1, matches: [histMatch(['Alice', 'Bob'], ['Carol', 'Dave'], 7, 3)] }],
    })
    const players = [{ id: 'p1', name: 'Alice Smith' }]
    const s = buildPlayerStats('p1', [], [], [], players, {}, [hist])
    // 'Alice' resolves to p1 via first-name fallback
    expect(s.won).toBe(1)
  })

  it('skips h2h for opponents that do not resolve', () => {
    const hist = histTournament({
      rounds: [{ round: 1, matches: [histMatch(['Alice'], ['Unknown'], 7, 3)] }],
    })
    const aliasMap = { Alice: 'p1' }
    const s = buildPlayerStats('p1', [], [], [], [], aliasMap, [hist])
    // Win still counted but h2h empty because opponent didn't resolve
    expect(s.won).toBe(1)
    expect(s.h2h).toEqual({})
  })

  it('skips h2hPairs when one opponent is unresolved', () => {
    const hist = histTournament({
      rounds: [{ round: 1, matches: [histMatch(['Alice', 'Bob'], ['Carol', 'Unknown'], 7, 3)] }],
    })
    const aliasMap = { Alice: 'p1', Bob: 'p2', Carol: 'p3' }
    const s = buildPlayerStats('p1', [], [], [], [], aliasMap, [hist])
    expect(Object.keys(s.h2hPairs)).toHaveLength(0)
  })

  it('accumulates historical and DB matches together', () => {
    const hist = histTournament({
      date: '2025-01-01',
      rounds: [{ round: 1, matches: [histMatch(['Alice'], ['Bob'], 7, 3)] }],
    })
    const aliasMap = { Alice: 'p1', Bob: 'p2' }
    const dbM = dbMatch({
      team1Ids: ['p1'],
      team2Ids: ['p2'],
      score1: 6,
      score2: 4,
      tournamentId: 't1',
    })
    const s = buildPlayerStats('p1', [dbM], [T1], [], [], aliasMap, [hist])
    expect(s.played).toBe(2)
    expect(s.won).toBe(2)
  })
})

// ─── Chronological ordering ───────────────────────────────────────────────────

describe('buildPlayerStats — event ordering for streaks', () => {
  it('historical events (older date) are processed before DB events', () => {
    // hist tournament in 2025, DB tournament in 2026.
    // hist = win, DB = loss → final streak should be 1 loss (not 1 win).
    const hist = histTournament({
      date: '2025-01-01',
      rounds: [{ round: 1, matches: [histMatch(['Alice'], ['Bob'], 7, 3)] }],
    })
    const aliasMap = { Alice: 'p1', Bob: 'p2' }
    const dbM = dbMatch({
      team1Ids: ['p1'],
      team2Ids: ['p2'],
      score1: 3,
      score2: 7,
      tournamentId: 't1',
    })
    const s = buildPlayerStats('p1', [dbM], [T1], [], [], aliasMap, [hist])
    // recentForm in chronological order: [W (hist), L (db)]
    expect(s.recentForm).toEqual(['W', 'L'])
  })
})
