import { describe, it, expect } from 'vitest'
import {
  SIGMA_PRIOR,
  SIGMA_FLOOR,
  SIGMA_INFLATION_PER_MONTH,
  initialRating,
  selfResetRating,
  inflateForInactivity,
} from './model'

describe('rating/model constants (D-003)', () => {
  it('exposes the blessed starting values', () => {
    expect(SIGMA_PRIOR).toBe(0.7)
    expect(SIGMA_FLOOR).toBe(0.15)
    expect(SIGMA_INFLATION_PER_MONTH).toBe(0.02)
  })
})

// M1.2 acceptance tests — frozen by M1.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes `.skip`; changing any assertion requires a
// coordinator DECISIONS.md entry.
describe('rating/model (M1.2)', () => {
  describe('initialRating', () => {
    it('anchors mu at the self-reported level with the prior sigma', () => {
      expect(initialRating({ playtomicLevel: 3.5 })).toEqual({ mu: 3.5, sigma: SIGMA_PRIOR })
    })

    it('works across the community level range', () => {
      expect(initialRating({ playtomicLevel: 1.0 }).mu).toBe(1.0)
      expect(initialRating({ playtomicLevel: 5.0 }).mu).toBe(5.0)
    })
  })

  describe('selfResetRating (D-002)', () => {
    it('re-anchors at the new level and drops back to the prior sigma', () => {
      expect(selfResetRating({ playtomicLevel: 4.2 })).toEqual({ mu: 4.2, sigma: SIGMA_PRIOR })
    })
  })

  describe('inflateForInactivity', () => {
    it('is a no-op at zero idle months', () => {
      const rating = { mu: 3, sigma: 0.3 }
      expect(inflateForInactivity({ rating, idleMonths: 0 })).toEqual(rating)
    })

    it('adds SIGMA_INFLATION_PER_MONTH per idle month, leaving mu untouched', () => {
      const out = inflateForInactivity({ rating: { mu: 3, sigma: 0.3 }, idleMonths: 3 })
      expect(out.mu).toBe(3)
      expect(out.sigma).toBeCloseTo(0.36, 12)
    })

    it('supports fractional months', () => {
      const out = inflateForInactivity({ rating: { mu: 3, sigma: 0.3 }, idleMonths: 1.5 })
      expect(out.sigma).toBeCloseTo(0.33, 12)
    })

    it('caps inflation at the prior sigma', () => {
      const out = inflateForInactivity({ rating: { mu: 3, sigma: 0.65 }, idleMonths: 5 })
      expect(out.sigma).toBe(SIGMA_PRIOR)
    })

    it('never decreases a sigma already at or above the prior', () => {
      expect(inflateForInactivity({ rating: { mu: 3, sigma: 0.7 }, idleMonths: 4 }).sigma).toBe(0.7)
      expect(inflateForInactivity({ rating: { mu: 3, sigma: 0.8 }, idleMonths: 4 }).sigma).toBe(0.8)
    })

    it('treats negative idle months as zero', () => {
      const rating = { mu: 3, sigma: 0.3 }
      expect(inflateForInactivity({ rating, idleMonths: -2 })).toEqual(rating)
    })

    it('returns a new object (input immutable)', () => {
      const rating = { mu: 3, sigma: 0.3 }
      inflateForInactivity({ rating, idleMonths: 6 })
      expect(rating).toEqual({ mu: 3, sigma: 0.3 })
    })
  })
})
