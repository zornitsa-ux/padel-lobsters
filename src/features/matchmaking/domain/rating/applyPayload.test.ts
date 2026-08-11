import { describe, expect, it, vi } from 'vitest'
import type { MatchResult, RatingUpdate } from '../types'

const { mockUpdateRatingsForTournament } = vi.hoisted(() => ({
  mockUpdateRatingsForTournament: vi.fn(),
}))

// Partial mock: default to the real implementation for every existing test,
// but let one test (the unknown-player guard below) override the return
// value directly — that guard is otherwise unreachable through the public
// `buildRatingUpdatePayload` surface, since `ratings` and the module's own
// `byId` are both derived from the same `players` array.
vi.mock('./update', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./update')>()
  return {
    ...actual,
    updateRatingsForTournament: mockUpdateRatingsForTournament.mockImplementation(
      actual.updateRatingsForTournament,
    ),
  }
})

import { buildRatingUpdatePayload, type RatingApplyPlayer } from './applyPayload'

const players = (ids: string[]): RatingApplyPlayer[] =>
  ids.map((playerId) => ({ playerId, mu: 3, sigma: 0.7, playtomicLevel: 3 }))

describe('buildRatingUpdatePayload', () => {
  it('drops players with no counted matches', () => {
    const matches: MatchResult[] = [
      { matchId: 'm1', round: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'], score1: 6, score2: 4 },
    ]
    const payload = buildRatingUpdatePayload({
      tournamentId: 't1',
      players: players(['p1', 'p2', 'p3', 'p4', 'p5']),
      matches,
    })
    expect(payload.updates.map((u) => u.player_id).sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('sets new_mu = prior_mu + applied_delta and breakdown sums to proposed_delta', () => {
    const matches: MatchResult[] = [
      { matchId: 'm1', round: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'], score1: 6, score2: 2 },
    ]
    const payload = buildRatingUpdatePayload({
      tournamentId: 't1',
      players: players(['p1', 'p2', 'p3', 'p4']),
      matches,
    })
    for (const u of payload.updates) {
      expect(u.new_mu).toBeCloseTo(u.prior_mu + u.applied_delta, 10)
      const breakdownSum = u.breakdown.reduce((s, r) => s + r.delta, 0)
      expect(breakdownSum).toBeCloseTo(u.proposed_delta, 10)
    }
  })

  it('caps a runaway delta and flags over_cap (applied stays within ±0.30)', () => {
    // p1 wins four blowouts from a high-sigma prior → proposed exceeds the cap.
    const matches: MatchResult[] = [
      { matchId: 'm1', round: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'], score1: 6, score2: 0 },
      { matchId: 'm2', round: 2, team1: ['p1', 'p5'], team2: ['p6', 'p7'], score1: 6, score2: 0 },
      { matchId: 'm3', round: 3, team1: ['p1', 'p8'], team2: ['p9', 'p3'], score1: 6, score2: 0 },
      { matchId: 'm4', round: 4, team1: ['p1', 'p4'], team2: ['p5', 'p6'], score1: 6, score2: 0 },
    ]
    const payload = buildRatingUpdatePayload({
      tournamentId: 't1',
      players: players(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']),
      matches,
    })
    const p1 = payload.updates.find((u) => u.player_id === 'p1')!
    expect(p1.proposed_delta).toBeGreaterThan(0.3)
    expect(p1.applied_delta).toBeCloseTo(0.3, 10)
    expect(p1.new_mu).toBeCloseTo(3.3, 10)
    expect(p1.flagged).toBe(true)
  })

  it('throws when a rating update refers to a player not in the players list', () => {
    // updateRatingsForTournament is mocked here to return a phantom player id
    // that never appeared in `players` — unreachable via the real domain
    // function, since its own `ratings` array is built from the same
    // `players` the module uses for lookup. This isolates the module's own
    // defensive guard (applyPayload.ts ~line 30).
    const ghostUpdate: RatingUpdate = {
      playerId: 'ghost',
      priorMu: 3,
      priorSigma: 0.7,
      proposedDelta: 0.1,
      newSigma: 0.65,
      matchDeltas: [],
    }
    mockUpdateRatingsForTournament.mockReturnValueOnce([ghostUpdate])

    expect(() =>
      buildRatingUpdatePayload({
        tournamentId: 't1',
        players: players(['p1', 'p2', 'p3', 'p4']),
        matches: [],
      }),
    ).toThrow('rating update for unknown player ghost')
  })
})
