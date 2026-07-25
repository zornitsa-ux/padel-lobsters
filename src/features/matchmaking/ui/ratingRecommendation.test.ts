import { describe, expect, it } from 'vitest'
import { describeRatingRecommendation } from './ratingRecommendation'
import type { BreakdownRow } from '../domain/types'

function row({
  delta,
  expectedShare,
  actualShare,
}: {
  delta: number
  expectedShare: number
  actualShare: number
}): BreakdownRow {
  return {
    matchId: `m${Math.random()}`,
    round: 1,
    partnerId: 'p',
    opponentIds: ['a', 'b'],
    teamAdvantage: 0,
    expectedShare,
    actualShare,
    delta,
  }
}

describe('describeRatingRecommendation', () => {
  it('recommends the full move when every match agrees and results are lopsided', () => {
    const breakdown = Array.from({ length: 5 }, () =>
      row({ delta: -0.1, expectedShare: 0.5, actualShare: 0.06 }),
    )
    const rec = describeRatingRecommendation({
      breakdown,
      proposedDelta: -0.49,
      fullLevel: 1.21,
      cautiousLevel: 1.4,
    })
    expect(rec.tone).toBe('strong')
    expect(rec.direction).toBe('down')
    expect(rec.recommendedMode).toBe('full')
    expect(rec.evidence[0]).toBe('All 5 matches point down')
    expect(rec.headline).toContain('1.21')
  })

  it('reads direction and wording for a raise', () => {
    const breakdown = Array.from({ length: 4 }, () =>
      row({ delta: 0.12, expectedShare: 0.45, actualShare: 0.92 }),
    )
    const rec = describeRatingRecommendation({
      breakdown,
      proposedDelta: 0.48,
      fullLevel: 2.1,
      cautiousLevel: 1.9,
    })
    expect(rec.tone).toBe('strong')
    expect(rec.direction).toBe('up')
    expect(rec.evidence[0]).toBe('All 4 matches point up')
  })

  it('falls back to cautious when the matches split', () => {
    const breakdown = [
      row({ delta: -0.15, expectedShare: 0.5, actualShare: 0.2 }),
      row({ delta: -0.15, expectedShare: 0.5, actualShare: 0.2 }),
      row({ delta: 0.15, expectedShare: 0.5, actualShare: 0.8 }),
      row({ delta: 0.15, expectedShare: 0.5, actualShare: 0.8 }),
    ]
    const rec = describeRatingRecommendation({
      breakdown,
      proposedDelta: -0.4,
      fullLevel: 1.21,
      cautiousLevel: 1.4,
    })
    expect(rec.tone).toBe('mixed')
    expect(rec.recommendedMode).toBe('cautious')
    expect(rec.evidence[0]).toBe('2 of 4 matches point down')
  })

  it('is moderate when most agree but the signal is not overwhelming', () => {
    const breakdown = [
      row({ delta: -0.1, expectedShare: 0.5, actualShare: 0.35 }),
      row({ delta: -0.1, expectedShare: 0.5, actualShare: 0.35 }),
      row({ delta: -0.1, expectedShare: 0.5, actualShare: 0.35 }),
      row({ delta: -0.1, expectedShare: 0.5, actualShare: 0.35 }),
      row({ delta: 0.05, expectedShare: 0.5, actualShare: 0.6 }),
    ]
    const rec = describeRatingRecommendation({
      breakdown,
      proposedDelta: -0.35,
      fullLevel: 1.21,
      cautiousLevel: 1.4,
    })
    expect(rec.tone).toBe('moderate')
    expect(rec.recommendedMode).toBe('full')
    expect(rec.evidence[0]).toBe('4 of 5 matches point down')
  })

  it('stays cautious with no breakdown to weigh', () => {
    const rec = describeRatingRecommendation({
      breakdown: [],
      proposedDelta: -0.4,
      fullLevel: 1.21,
      cautiousLevel: 1.4,
    })
    expect(rec.tone).toBe('moderate')
    expect(rec.recommendedMode).toBe('cautious')
    expect(rec.evidence).toEqual([])
  })
})
