import { describe, expect, it } from 'vitest'
import { describeQualityDiff } from './dimensions'
import type { QualityDimensions } from '../domain/types'

// describeQualityDiff (D-022 wording). Thresholds under test, read from
// dimensions.ts: DIFF_THRESHOLD = 3 (inclusive floor to be mentioned at all),
// SLIGHT_THRESHOLD = 8 (exclusive ceiling for "Slightly" wording), MAX_DIFF_LINES = 3.

const base: QualityDimensions = {
  balance: 50,
  partnerFairness: 50,
  variety: 50,
  sitoutFairness: 50,
  genderPreference: 50,
}

const withDelta = (deltas: Partial<QualityDimensions>): QualityDimensions => ({
  ...base,
  ...Object.fromEntries(
    Object.entries(deltas).map(([k, v]) => [k, base[k as keyof QualityDimensions] + v!]),
  ),
})

describe('describeQualityDiff', () => {
  describe('DIFF_THRESHOLD boundary (3 points)', () => {
    it('excludes a delta just under the threshold', () => {
      const alternative = withDelta({ balance: 2.999 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([])
    })

    it('includes a delta exactly at the threshold', () => {
      const alternative = withDelta({ balance: 3 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Slightly better balance',
      ])
    })

    it('includes a delta just over the threshold', () => {
      const alternative = withDelta({ balance: 3.001 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Slightly better balance',
      ])
    })
  })

  describe('SLIGHT_THRESHOLD boundary (8 points)', () => {
    it('uses "Slightly better" just under the threshold (positive delta)', () => {
      const alternative = withDelta({ variety: 7.999 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Slightly better variety',
      ])
    })

    it('uses "Better" exactly at the threshold (positive delta)', () => {
      const alternative = withDelta({ variety: 8 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual(['Better variety'])
    })

    it('uses "Slightly worse" just under the threshold (negative delta)', () => {
      const alternative = withDelta({ variety: -7.999 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Slightly worse variety',
      ])
    })

    it('uses "Worse" exactly at the threshold (negative delta)', () => {
      const alternative = withDelta({ variety: -8 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual(['Worse variety'])
    })
  })

  describe('sign handling', () => {
    it('describes an improvement', () => {
      const alternative = withDelta({ sitoutFairness: 10 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Better sit-out fairness',
      ])
    })

    it('describes a regression', () => {
      const alternative = withDelta({ sitoutFairness: -10 })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Worse sit-out fairness',
      ])
    })
  })

  describe('ordering', () => {
    it('orders returned lines by descending magnitude, independent of dimension order', () => {
      // partnerFairness delta magnitude 4 < genderPreference magnitude 20 < balance magnitude 10,
      // deliberately not entered in output order.
      const alternative = withDelta({
        partnerFairness: 4,
        genderPreference: -20,
        balance: 10,
      })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([
        'Worse gender preference',
        'Better balance',
        'Slightly better partner fairness',
      ])
    })
  })

  describe('truncation', () => {
    it('returns at most 3 lines, keeping the largest magnitudes, when more than 3 dimensions cross the threshold', () => {
      const alternative = withDelta({
        balance: 5,
        partnerFairness: 20,
        variety: 15,
        sitoutFairness: 10,
        genderPreference: 4,
      })
      const result = describeQualityDiff({ original: base, alternative })
      expect(result).toHaveLength(3)
      expect(result).toEqual([
        'Better partner fairness',
        'Better variety',
        'Better sit-out fairness',
      ])
    })
  })

  describe('no meaningful difference', () => {
    it('returns [] when every delta is under the threshold', () => {
      const alternative = withDelta({
        balance: 1,
        partnerFairness: -2,
        variety: 0,
        sitoutFairness: 2.5,
        genderPreference: -2.999,
      })
      expect(describeQualityDiff({ original: base, alternative })).toEqual([])
    })

    it('returns [] for identical dimensions', () => {
      expect(describeQualityDiff({ original: base, alternative: { ...base } })).toEqual([])
    })
  })
})
