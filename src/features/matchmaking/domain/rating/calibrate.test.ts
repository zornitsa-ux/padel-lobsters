import { describe, it, expect } from 'vitest'
import type { MatchResult, RatedPlayer } from '../types'
import { DEFAULT_RATING_PARAMS } from '../types'
import { SIGMA_PRIOR } from './model'
import { expectedShare } from './update'
import {
  backtestBrier,
  fitParams,
  type CalibrationDataset,
  type CalibrationEvent,
} from './calibrate'

const rp = (playerId: string, mu: number, sigma = SIGMA_PRIOR): RatedPlayer => ({
  playerId,
  mu,
  sigma,
})

const m = (partial: Partial<MatchResult>, i: number): MatchResult => ({
  matchId: `m${i}`,
  round: 1,
  team1: ['a', 'b'],
  team2: ['c', 'd'],
  score1: 3,
  score2: 3,
  ...partial,
})

const event = (eventId: string, sortKey: number, matches: MatchResult[]): CalibrationEvent => ({
  eventId,
  sortKey,
  matches,
})

describe('backtestBrier', () => {
  it('scores 0 when every prediction equals the observed share (equal teams, even scores)', () => {
    const dataset: CalibrationDataset = {
      priors: [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)],
      events: [event('e1', 1, [m({ score1: 3, score2: 3 }, 1)])],
    }
    const r = backtestBrier({ dataset })
    expect(r.n).toBe(1)
    expect(r.brier).toBeCloseTo(0, 12)
  })

  it('scores (E − p)² for a single mispredicted match', () => {
    const dataset: CalibrationDataset = {
      priors: [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)],
      events: [event('e1', 1, [m({ score1: 6, score2: 0 }, 1)])],
    }
    // Equal teams ⇒ E = 0.5; observed share p = 1.0.
    const r = backtestBrier({ dataset })
    expect(r.brier).toBeCloseTo(0.25, 12)
  })

  it('excludes zero-total matches from the count', () => {
    const dataset: CalibrationDataset = {
      priors: [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)],
      events: [
        event('e1', 1, [
          m({ matchId: 'x', score1: 0, score2: 0 }, 1),
          m({ score1: 3, score2: 3 }, 2),
        ]),
      ],
    }
    const r = backtestBrier({ dataset })
    expect(r.n).toBe(1)
  })

  it('skips matches with an unknown player rather than throwing', () => {
    const dataset: CalibrationDataset = {
      priors: [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)],
      events: [event('e1', 1, [m({ team2: ['c', 'zzz'], score1: 4, score2: 2 }, 1)])],
    }
    const r = backtestBrier({ dataset })
    expect(r.n).toBe(0)
    expect(r.brier).toBe(0)
  })

  it('skips a match with the same player twice rather than throwing', () => {
    const dataset: CalibrationDataset = {
      priors: [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)],
      // 'a' appears on both teams — update.ts would throw; the backtest skips it.
      events: [event('e1', 1, [m({ team2: ['a', 'c'], score1: 4, score2: 2 }, 1)])],
    }
    const r = backtestBrier({ dataset })
    expect(r.n).toBe(0)
    expect(r.brier).toBe(0)
  })

  it('predicts each match against pre-event ratings, then learns for later events', () => {
    // Same fixed matchup twice; a's team wins big both times. The second event
    // is predicted against ratings already nudged by the first, so its per-match
    // Brier must be no worse than the first (the model moved toward reality).
    const win = { score1: 6, score2: 1 }
    const dataset: CalibrationDataset = {
      priors: [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)],
      events: [event('e1', 1, [m(win, 1)]), event('e2', 2, [m({ ...win, matchId: 'm2' }, 2)])],
    }
    const r = backtestBrier({ dataset })
    expect(r.perEvent).toHaveLength(2)
    expect(r.perEvent[1].brier).toBeLessThanOrEqual(r.perEvent[0].brier + 1e-12)
  })

  it('is deterministic', () => {
    const dataset: CalibrationDataset = {
      priors: [rp('a', 4), rp('b', 2), rp('c', 3), rp('d', 3)],
      events: [event('e1', 1, [m({ score1: 5, score2: 2 }, 1)])],
    }
    expect(backtestBrier({ dataset })).toEqual(backtestBrier({ dataset }))
  })

  it('sorts events by sortKey regardless of input order', () => {
    const win = { score1: 6, score2: 1 }
    const priors = [rp('a', 3), rp('b', 3), rp('c', 3), rp('d', 3)]
    const forward: CalibrationDataset = {
      priors,
      events: [event('e1', 1, [m(win, 1)]), event('e2', 2, [m({ ...win, matchId: 'm2' }, 2)])],
    }
    const reversed: CalibrationDataset = {
      priors,
      events: [event('e2', 2, [m({ ...win, matchId: 'm2' }, 2)]), event('e1', 1, [m(win, 1)])],
    }
    expect(backtestBrier({ dataset: reversed })).toEqual(backtestBrier({ dataset: forward }))
  })
})

describe('fitParams', () => {
  // A dataset where team1 (strong) reliably takes ~5/6 of the points. The
  // levelScale that maps a +2.0 mu advantage to ~0.83 expected share fits best.
  const strong = (i: number) =>
    m({ matchId: `s${i}`, team1: ['a', 'b'], team2: ['c', 'd'], score1: 5, score2: 1 }, i)
  const lopsided: CalibrationDataset = {
    priors: [rp('a', 4), rp('b', 4), rp('c', 3), rp('d', 3)],
    events: [event('e1', 1, [strong(1), strong(2), strong(3)])],
  }

  it('returns params drawn from the grid', () => {
    const grid = { levelScale: [2, 4, 6, 8, 12] }
    const { params } = fitParams({ dataset: lopsided, grid })
    expect(grid.levelScale).toContain(params.levelScale)
  })

  it('never scores worse than the starting params', () => {
    const grid = { levelScale: [2, 4, 6, 8, 12] }
    const startBrier = backtestBrier({ dataset: lopsided, params: DEFAULT_RATING_PARAMS }).brier
    const { brier } = fitParams({ dataset: lopsided, grid })
    expect(brier).toBeLessThanOrEqual(startBrier + 1e-12)
  })

  it('picks the grid levelScale with the lowest Brier', () => {
    const grid = { levelScale: [1, 2, 4, 6, 8, 12, 20] }
    const { params, brier } = fitParams({ dataset: lopsided, grid })
    for (const v of grid.levelScale) {
      const b = backtestBrier({ dataset: lopsided, params: { ...params, levelScale: v } }).brier
      expect(brier).toBeLessThanOrEqual(b + 1e-12)
    }
  })

  it('is deterministic', () => {
    const grid = { levelScale: [2, 4, 6, 8], learnScale: [0.5, 1, 2] }
    expect(fitParams({ dataset: lopsided, grid })).toEqual(fitParams({ dataset: lopsided, grid }))
  })
})

describe('expectedShare (shared with update.ts)', () => {
  it('is 0.5 at zero advantage and 10/11 at advantage = levelScale', () => {
    expect(expectedShare({ teamAdvantage: 0, levelScale: 6 })).toBeCloseTo(0.5, 12)
    expect(expectedShare({ teamAdvantage: 6, levelScale: 6 })).toBeCloseTo(10 / 11, 12)
  })
})
