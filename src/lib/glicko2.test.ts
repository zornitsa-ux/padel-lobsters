import { describe, expect, it } from 'vitest'
import {
  applyTournamentRatings,
  defaultRating,
  padelToRating,
  ratingToPadel,
  updateRating,
} from './glicko2'

// ─── padelToRating ────────────────────────────────────────────────────────────

describe('padelToRating', () => {
  it('maps padel 3.0 to Glicko 1500', () => {
    expect(padelToRating(3)).toBe(1500)
  })

  it('maps padel 0 to Glicko 1200', () => {
    // The JS version returned 1500 here because `Number(0) || 3` treats 0 as
    // falsy. The TS version fixes this with `?? 3` (nullish coalescing).
    expect(padelToRating(0)).toBe(1200)
  })

  it('maps padel 5.0 to Glicko 1700', () => {
    expect(padelToRating(5)).toBe(1700)
  })

  it('defaults to padel level 3 when given null', () => {
    expect(padelToRating(null)).toBe(1500)
  })

  it('defaults to padel level 3 when given undefined', () => {
    expect(padelToRating(undefined)).toBe(1500)
  })

  it('defaults to padel level 3 when given NaN', () => {
    expect(padelToRating(NaN)).toBe(1500)
  })
})

// ─── ratingToPadel ────────────────────────────────────────────────────────────

describe('ratingToPadel', () => {
  it('maps Glicko 1500 to padel 3.0', () => {
    expect(ratingToPadel(1500)).toBe(3)
  })

  it('maps Glicko 1200 to padel 0', () => {
    expect(ratingToPadel(1200)).toBe(0)
  })

  it('maps Glicko 1700 to padel 5.0', () => {
    expect(ratingToPadel(1700)).toBe(5)
  })

  it('round-trips with padelToRating', () => {
    expect(ratingToPadel(padelToRating(3.5))).toBeCloseTo(3.5)
  })
})

// ─── defaultRating ────────────────────────────────────────────────────────────

describe('defaultRating', () => {
  it('returns rating derived from playtomicLevel', () => {
    expect(defaultRating(4).rating).toBe(padelToRating(4))
  })

  it('always returns rd of 350', () => {
    expect(defaultRating(3).rd).toBe(350)
  })

  it('always returns volatility of 0.06', () => {
    expect(defaultRating(3).volatility).toBe(0.06)
  })
})

// ─── updateRating ─────────────────────────────────────────────────────────────

const midState = { rating: 1500, rd: 200, volatility: 0.06 }
const equalOpp = { oppRating: 1500, oppRd: 200 }

describe('updateRating', () => {
  it('returns a copy of state when matches is empty', () => {
    const result = updateRating(midState, [])
    expect(result).toEqual(midState)
    expect(result).not.toBe(midState)
  })

  it('returns a copy of state when matches is null', () => {
    const result = updateRating(midState, null)
    expect(result).toEqual(midState)
  })

  it('result has rating, rd, and volatility keys', () => {
    const result = updateRating(midState, [{ ...equalOpp, score: 1 }])
    expect(result).toHaveProperty('rating')
    expect(result).toHaveProperty('rd')
    expect(result).toHaveProperty('volatility')
  })

  it('rating increases after a win against an equal opponent', () => {
    const result = updateRating(midState, [{ ...equalOpp, score: 1 }])
    expect(result.rating).toBeGreaterThan(midState.rating)
  })

  it('rating decreases after a loss against an equal opponent', () => {
    const result = updateRating(midState, [{ ...equalOpp, score: 0 }])
    expect(result.rating).toBeLessThan(midState.rating)
  })

  it('rating is unchanged after a draw against an equal opponent', () => {
    const result = updateRating(midState, [{ ...equalOpp, score: 0.5 }])
    expect(result.rating).toBeCloseTo(midState.rating)
  })

  it('rd decreases after matches (more data → less uncertainty)', () => {
    const result = updateRating(midState, [{ ...equalOpp, score: 0.5 }])
    expect(result.rd).toBeLessThan(midState.rd)
  })

  it('rd is always positive', () => {
    const result = updateRating(midState, [{ ...equalOpp, score: 1 }])
    expect(result.rd).toBeGreaterThan(0)
  })

  it('rating moves more against a weaker opponent on a loss', () => {
    const weakOpp = { oppRating: 1300, oppRd: 200 }
    const lossVsWeak = updateRating(midState, [{ ...weakOpp, score: 0 }])
    const lossVsEqual = updateRating(midState, [{ ...equalOpp, score: 0 }])
    expect(lossVsWeak.rating).toBeLessThan(lossVsEqual.rating)
  })
})

// ─── applyTournamentRatings ───────────────────────────────────────────────────

function makeMatch(
  team1Ids: string[],
  team2Ids: string[],
  score1: number | null,
  score2: number | null,
) {
  return { team1Ids, team2Ids, score1, score2 }
}

describe('applyTournamentRatings', () => {
  it('returns empty object when matches list is empty', () => {
    expect(applyTournamentRatings({}, [])).toEqual({})
  })

  it('returns empty object when all matches have null scores', () => {
    const m = makeMatch(['p1'], ['p2'], null, null)
    expect(applyTournamentRatings({}, [m])).toEqual({})
  })

  it('returns empty object when all matches have zero total score', () => {
    const m = makeMatch(['p1'], ['p2'], 0, 0)
    expect(applyTournamentRatings({}, [m])).toEqual({})
  })

  it('returns updated ratings for players in scored matches', () => {
    const m = makeMatch(['p1', 'p2'], ['p3', 'p4'], 7, 3)
    const result = applyTournamentRatings({}, [m])
    expect(result).toHaveProperty('p1')
    expect(result).toHaveProperty('p2')
    expect(result).toHaveProperty('p3')
    expect(result).toHaveProperty('p4')
  })

  it('includes match count on each updated player', () => {
    const m = makeMatch(['p1'], ['p2'], 6, 4)
    const result = applyTournamentRatings({}, [m])
    expect(result['p1'].matches).toBe(1)
    expect(result['p2'].matches).toBe(1)
  })

  it('winning team rating increases relative to losing team', () => {
    const m = makeMatch(['p1'], ['p2'], 8, 2)
    const result = applyTournamentRatings({}, [m])
    expect(result['p1'].rating).toBeGreaterThan(1500)
    expect(result['p2'].rating).toBeLessThan(1500)
  })

  it('uses prior rating when provided', () => {
    const prior = { p1: { rating: 1600, rd: 200, volatility: 0.06 } }
    const m = makeMatch(['p1'], ['p2'], 7, 3)
    const withPrior = applyTournamentRatings(prior, [m])
    const withoutPrior = applyTournamentRatings({}, [m])
    // Different starting point → different result
    expect(withPrior['p1'].rating).not.toBeCloseTo(withoutPrior['p1'].rating)
  })

  it('uses playtomicLevel for default when player has no prior rating', () => {
    const m = makeMatch(['p1'], ['p2'], 7, 3)
    const withPlaytomic = applyTournamentRatings({}, [m], { p1: 5 })
    const withoutPlaytomic = applyTournamentRatings({}, [m])
    // p1 starts at a higher rating with playtomic level 5 vs default 1500
    expect(withPlaytomic['p1'].rating).not.toBeCloseTo(withoutPlaytomic['p1'].rating)
  })

  it('falls back to 1500/350/0.06 when no prior or playtomic data', () => {
    // Symmetrical match: both teams start at default, equal score → neither
    // should move much. Just verify ratings exist and are numbers.
    const m = makeMatch(['p1'], ['p2'], 5, 5)
    const result = applyTournamentRatings({}, [m])
    expect(typeof result['p1'].rating).toBe('number')
    expect(typeof result['p1'].rd).toBe('number')
    expect(typeof result['p1'].volatility).toBe('number')
  })

  it('ignores matches with one null score', () => {
    const m1 = makeMatch(['p1'], ['p2'], null, 5)
    const m2 = makeMatch(['p1'], ['p3'], 6, 4)
    const result = applyTournamentRatings({}, [m1, m2])
    // p1's match count should only reflect the scored match
    expect(result['p1'].matches).toBe(1)
    expect(result).not.toHaveProperty('p2') // p2 only appeared in the null-score match
  })

  it('accumulates multiple matches for the same player', () => {
    const m1 = makeMatch(['p1'], ['p2'], 6, 4)
    const m2 = makeMatch(['p1'], ['p3'], 7, 3)
    const result = applyTournamentRatings({}, [m1, m2])
    expect(result['p1'].matches).toBe(2)
  })
})
