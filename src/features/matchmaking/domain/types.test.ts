import { describe, it, expect } from 'vitest'
import { mkConfig, mkPlayer } from './testkit'
import {
  DEFAULT_RATING_PARAMS,
  DEFAULT_WEIGHTS,
  generateInputSchema,
  matchConfigSchema,
  matchResultSchema,
  playerInputSchema,
  ratingParamsSchema,
  ratingUpdateSchema,
  scheduleRunSchema,
  weightsSchema,
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

describe('matcher contracts (M2.1)', () => {
  it('DEFAULT_WEIGHTS pins the DESIGN §3.2 exchange rates and satisfies its schema', () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      teamBalance: 1.0,
      partnerGap: 0.8,
      courtSpread: 1.5,
      opponentRepeat: 0.6,
      partnerRepeat: 5.0,
      mixedPreference: 0.3,
      sitGroupOverlap: 0.4,
    })
    expect(weightsSchema.safeParse(DEFAULT_WEIGHTS).success).toBe(true)
  })

  it('accepts a minimal match config and rejects out-of-range knobs', () => {
    expect(matchConfigSchema.safeParse({ preset: 'balanced' }).success).toBe(true)
    expect(matchConfigSchema.safeParse({ preset: 'pro' }).success).toBe(false)
    expect(matchConfigSchema.safeParse({ preset: 'social', socialDial: 1.5 }).success).toBe(false)
    expect(matchConfigSchema.safeParse({ preset: 'social', seed: -1 }).success).toBe(false)
  })

  it('requires an explicit gender bucket on player input (D-011)', () => {
    const base = { playerId: 'p1', name: 'P 1', mu: 3.2, sigma: 0.4, isLeftHanded: false }
    expect(playerInputSchema.safeParse({ ...base, gender: 'unknown' }).success).toBe(true)
    expect(playerInputSchema.safeParse({ ...base, gender: '' }).success).toBe(false)
    expect(playerInputSchema.safeParse(base).success).toBe(false)
  })

  it('rejects a generate input with fewer than four players', () => {
    const base = {
      tournamentId: 't-1',
      courts: 1,
      rounds: 4,
      genderMode: 'men',
      config: { preset: 'balanced' },
    }
    const players = (n: number) =>
      Array.from({ length: n }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))
    expect(generateInputSchema.safeParse({ ...base, players: players(4) }).success).toBe(true)
    expect(generateInputSchema.safeParse({ ...base, players: players(3) }).success).toBe(false)
  })

  it('accepts a well-formed schedule run report', () => {
    const four = Array.from({ length: 4 }, (_, i) => mkPlayer({ playerId: `p${i + 1}` }))
    const quality = {
      balance: 100,
      partnerFairness: 100,
      variety: 100,
      sitoutFairness: 100,
      genderPreference: 100,
    }
    const run = {
      tournamentId: 't-1',
      config: mkConfig(),
      seed: 1,
      feasibility: [{ rule: 'lefty', status: 'ok', detail: 'no lefty pressure' }],
      rounds: [
        {
          courts: [
            {
              players: four,
              teams: [
                ['p1', 'p2'],
                ['p3', 'p4'],
              ],
              teamSums: [6, 6],
              courtSpread: 0,
              flags: [],
            },
          ],
          sitters: [],
        },
      ],
      quality: { overall: quality, perRound: [quality] },
      violations: [{ round: 1, court: null, rule: 'sit-outs', reason: 'example' }],
    }
    expect(scheduleRunSchema.safeParse(run).success).toBe(true)
  })
})
