import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RATING_PARAMS,
  matchResultSchema,
  ratingParamsSchema,
  ratingUpdateSchema,
} from './types'

describe('rating contracts (M1.1)', () => {
  it('DEFAULT_RATING_PARAMS satisfies its own schema', () => {
    expect(ratingParamsSchema.safeParse(DEFAULT_RATING_PARAMS).success).toBe(true)
  })

  it('accepts a well-formed match result', () => {
    const result = matchResultSchema.safeParse({
      matchId: 'm1',
      round: 1,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 16,
      score2: 8,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative and non-integer scores', () => {
    const base = {
      matchId: 'm1',
      round: 1,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
    }
    expect(matchResultSchema.safeParse({ ...base, score1: -1, score2: 8 }).success).toBe(false)
    expect(matchResultSchema.safeParse({ ...base, score1: 1.5, score2: 8 }).success).toBe(false)
  })

  it('rejects teams that are not exactly two players', () => {
    const base = { matchId: 'm1', round: 1, team2: ['p3', 'p4'], score1: 0, score2: 0 }
    expect(matchResultSchema.safeParse({ ...base, team1: ['p1'] }).success).toBe(false)
    expect(matchResultSchema.safeParse({ ...base, team1: ['p1', 'p2', 'p5'] }).success).toBe(false)
  })

  it('rejects a rating update with non-positive sigma', () => {
    const update = {
      playerId: 'p1',
      priorMu: 3,
      priorSigma: 0.7,
      proposedDelta: 0.1,
      newSigma: 0,
      matchDeltas: [],
    }
    expect(ratingUpdateSchema.safeParse(update).success).toBe(false)
  })
})
