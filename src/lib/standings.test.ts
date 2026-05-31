import { describe, expect, it } from 'vitest'
import { computeTournamentStandings, rankOfPlayer } from './standings'
import type { MatchForStandings } from './standings'

function match(
  overrides: Partial<MatchForStandings> & {
    team1Ids: (string | number)[]
    team2Ids: (string | number)[]
  },
): MatchForStandings {
  return {
    tournamentId: 't1',
    score1: 0,
    score2: 0,
    completed: true,
    ...overrides,
  }
}

describe('computeTournamentStandings', () => {
  it('returns [] when there are no matches', () => {
    expect(computeTournamentStandings('t1', [])).toEqual([])
  })

  it('returns [] when no matches belong to the given tournament', () => {
    const m = match({
      tournamentId: 't2',
      team1Ids: ['p1'],
      team2Ids: ['p2'],
      score1: 5,
      score2: 3,
    })
    expect(computeTournamentStandings('t1', [m])).toEqual([])
  })

  it('returns [] when all matches for the tournament are incomplete', () => {
    const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 5, score2: 3, completed: false })
    expect(computeTournamentStandings('t1', [m])).toEqual([])
  })

  it('accumulates points from score1 for team1 players', () => {
    const m = match({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 7, score2: 3 })
    const standings = computeTournamentStandings('t1', [m])
    const p1 = standings.find((s) => s.id === 'p1')!
    expect(p1.points).toBe(7)
    expect(p1.pointsFor).toBe(7)
    expect(p1.pointsAgainst).toBe(3)
    expect(p1.played).toBe(1)
    expect(p1.won).toBe(1)
    expect(p1.lost).toBe(0)
  })

  it('accumulates points from score2 for team2 players', () => {
    const m = match({ team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'], score1: 7, score2: 3 })
    const standings = computeTournamentStandings('t1', [m])
    const p3 = standings.find((s) => s.id === 'p3')!
    expect(p3.points).toBe(3)
    expect(p3.won).toBe(0)
    expect(p3.lost).toBe(1)
  })

  it('draws: neither won nor lost incremented when scores are equal', () => {
    const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 5, score2: 5 })
    const standings = computeTournamentStandings('t1', [m])
    const p1 = standings.find((s) => s.id === 'p1')!
    expect(p1.won).toBe(0)
    expect(p1.lost).toBe(0)
    expect(p1.points).toBe(5)
  })

  it('accumulates across multiple matches', () => {
    const m1 = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 6, score2: 4 })
    const m2 = match({ team1Ids: ['p1'], team2Ids: ['p3'], score1: 3, score2: 7 })
    const standings = computeTournamentStandings('t1', [m1, m2])
    const p1 = standings.find((s) => s.id === 'p1')!
    expect(p1.played).toBe(2)
    expect(p1.won).toBe(1)
    expect(p1.lost).toBe(1)
    expect(p1.points).toBe(9)
  })

  it('sorts by points descending', () => {
    const m1 = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 8, score2: 2 })
    const m2 = match({ team1Ids: ['p3'], team2Ids: ['p4'], score1: 6, score2: 4 })
    const [first, , , last] = computeTournamentStandings('t1', [m1, m2])
    expect(first.id).toBe('p1')
    expect(last.id).toBe('p2')
  })

  it('tiebreaks by matches won when points are equal', () => {
    // p1 and p2 both get 5 points, but p1 won their match while p2 lost theirs
    const m1 = match({ team1Ids: ['p1'], team2Ids: ['p3'], score1: 5, score2: 4 })
    const m2 = match({ team1Ids: ['p4'], team2Ids: ['p2'], score1: 6, score2: 5 })
    const standings = computeTournamentStandings('t1', [m1, m2])
    const ids = standings.map((s) => s.id)
    expect(ids.indexOf('p1')).toBeLessThan(ids.indexOf('p2'))
  })

  it('tiebreaks by head-to-head when points and wins are equal', () => {
    // p1 beats p2 directly; they otherwise have identical stats
    const m1 = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 6, score2: 5 })
    const m2 = match({ team1Ids: ['p1'], team2Ids: ['p3'], score1: 5, score2: 6 })
    const m3 = match({ team1Ids: ['p2'], team2Ids: ['p3'], score1: 6, score2: 5 })
    const standings = computeTournamentStandings('t1', [m1, m2, m3])
    // p1: 11pts 1W; p2: 11pts 1W; p1 beat p2 directly → p1 ranks higher
    const ids = standings.map((s) => s.id)
    expect(ids.indexOf('p1')).toBeLessThan(ids.indexOf('p2'))
  })

  it('coerces string/number tournamentId equivalently', () => {
    const m = match({ tournamentId: 42, team1Ids: ['p1'], team2Ids: ['p2'], score1: 5, score2: 3 })
    expect(computeTournamentStandings('42', [m])).toHaveLength(2)
    expect(computeTournamentStandings(42, [m])).toHaveLength(2)
  })

  it('accepts string scores', () => {
    const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: '7', score2: '3' })
    const standings = computeTournamentStandings('t1', [m])
    expect(standings.find((s) => s.id === 'p1')!.points).toBe(7)
  })

  it('excludes matches from other tournaments but includes the target ones', () => {
    const m1 = match({
      tournamentId: 't1',
      team1Ids: ['p1'],
      team2Ids: ['p2'],
      score1: 5,
      score2: 3,
    })
    const m2 = match({
      tournamentId: 't2',
      team1Ids: ['p3'],
      team2Ids: ['p4'],
      score1: 6,
      score2: 4,
    })
    const standings = computeTournamentStandings('t1', [m1, m2])
    const ids = standings.map((s) => s.id)
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
    expect(ids).not.toContain('p3')
    expect(ids).not.toContain('p4')
  })

  describe('playerIds seed', () => {
    it('includes seeded players with zero stats when they have no matches', () => {
      const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 5, score2: 3 })
      const standings = computeTournamentStandings('t1', [m], ['p1', 'p2', 'p3'])
      expect(standings).toHaveLength(3)
      const p3 = standings.find((s) => s.id === 'p3')!
      expect(p3.played).toBe(0)
      expect(p3.points).toBe(0)
    })

    it('deduplicates IDs that appear in both seed list and matches', () => {
      const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 5, score2: 3 })
      const standings = computeTournamentStandings('t1', [m], ['p1', 'p2'])
      expect(standings).toHaveLength(2)
    })

    it('coerces numeric seed IDs to strings', () => {
      const m = match({ team1Ids: ['1'], team2Ids: ['2'], score1: 5, score2: 3 })
      const standings = computeTournamentStandings('t1', [m], [1, 2, 3])
      expect(standings).toHaveLength(3)
    })
  })
})

describe('rankOfPlayer', () => {
  it('returns null when there are no completed matches', () => {
    expect(rankOfPlayer('p1', 't1', [])).toBeNull()
  })

  it('returns null when the player is not in the standings', () => {
    const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 5, score2: 3 })
    expect(rankOfPlayer('p99', 't1', [m])).toBeNull()
  })

  it('returns rank 1 for the top player', () => {
    const m = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 8, score2: 2 })
    expect(rankOfPlayer('p1', 't1', [m])).toEqual({ rank: 1, total: 2 })
  })

  it('returns correct rank and total for a mid-table player', () => {
    const m1 = match({ team1Ids: ['p1'], team2Ids: ['p2'], score1: 8, score2: 2 })
    const m2 = match({ team1Ids: ['p3'], team2Ids: ['p2'], score1: 7, score2: 3 })
    // p1: 8pts, p3: 7pts, p2: 5pts
    expect(rankOfPlayer('p3', 't1', [m1, m2])).toEqual({ rank: 2, total: 3 })
  })
})
