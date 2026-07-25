import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MatchResult, RatingUpdate } from './domain/types'

const { mockRpc, mockFrom, mockUpdateRatingsForTournament } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockUpdateRatingsForTournament: vi.fn(),
}))

vi.mock('../../supabase', () => ({ supabase: { rpc: mockRpc, from: mockFrom } }))

// Partial mock: default to the real implementation for every existing test,
// but let one test (the unknown-player guard below) override the return
// value directly — that guard is otherwise unreachable through the public
// `buildRatingUpdatePayload` surface, since `ratings` and the service's own
// `byId` are both derived from the same `players` array.
vi.mock('./domain/rating/update', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./domain/rating/update')>()
  return {
    ...actual,
    updateRatingsForTournament: mockUpdateRatingsForTournament.mockImplementation(
      actual.updateRatingsForTournament,
    ),
  }
})

import {
  applyTournamentRatings,
  buildRatingUpdatePayload,
  fetchRatingReviewQueue,
  reviewRatingEvent,
  type RatingApplyPlayer,
} from './applyTournamentRatings.service'

const players = (ids: string[]): RatingApplyPlayer[] =>
  ids.map((playerId) => ({ playerId, mu: 3, sigma: 0.7, playtomicLevel: 3 }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

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
    // `players` the service uses for lookup. This isolates the service's own
    // defensive guard (applyTournamentRatings.service.ts ~line 50).
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

describe('applyTournamentRatings', () => {
  it('calls the RPC and returns the row count', async () => {
    mockRpc.mockResolvedValue({ data: 4, error: null })
    const payload = { tournament_id: 't1', updates: [] }
    const count = await applyTournamentRatings(payload)

    expect(count).toBe(4)
    expect(mockRpc).toHaveBeenCalledWith('admin_apply_tournament_ratings', {
      input_payload: payload,
    })
  })

  it('throws when the RPC errors', async () => {
    const err = { message: 'already applied' }
    mockRpc.mockResolvedValue({ data: null, error: err })
    await expect(applyTournamentRatings({ tournament_id: 't1', updates: [] })).rejects.toBe(err)
  })
})

describe('reviewRatingEvent', () => {
  const row = {
    id: 'e1',
    kind: 'tournament',
    tournament_id: 't1',
    player_id: 'p1',
    prior_mu: '3',
    prior_sigma: '0.7',
    proposed_delta: '0.5',
    applied_delta: '0.5',
    flagged: true,
    review_status: 'approved',
    reviewed_by: 'admin',
    reviewed_at: '2026-07-14T00:00:00Z',
    breakdown: [],
    created_at: '2026-07-13T00:00:00Z',
  }

  it('passes action + delta and coerces the returned numeric columns', async () => {
    mockRpc.mockResolvedValue({ data: row, error: null })
    const result = await reviewRatingEvent({ eventId: 'e1', action: 'edit', delta: 0.1 })

    expect(mockRpc).toHaveBeenCalledWith('admin_review_rating_event', {
      input_event_id: 'e1',
      input_action: 'edit',
      input_delta: 0.1,
    })
    expect(result.prior_mu).toBe(3)
    expect(result.applied_delta).toBe(0.5)
    expect(result.review_status).toBe('approved')
  })

  it('sends null delta when none is provided', async () => {
    mockRpc.mockResolvedValue({ data: row, error: null })
    await reviewRatingEvent({ eventId: 'e1', action: 'approve' })
    expect(mockRpc.mock.calls[0][1].input_delta).toBeNull()
  })

  it('rejects with a zod error when the RPC "succeeds" but the row is malformed', async () => {
    // No transport error — the RPC reports success, but the payload is
    // missing a required column (id). ratingEventRowSchema.parse must reject
    // this rather than let a malformed row silently through.
    const { id: _id, ...malformedRow } = row
    mockRpc.mockResolvedValue({ data: malformedRow, error: null })
    await expect(reviewRatingEvent({ eventId: 'e1', action: 'approve' })).rejects.toThrow()
  })
})

describe('fetchRatingReviewQueue', () => {
  it('queries flagged, unreviewed events oldest-first and parses the rows', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const is = vi.fn(() => ({ order }))
    const eq = vi.fn(() => ({ is }))
    const select = vi.fn(() => ({ eq }))
    mockFrom.mockReturnValue({ select })

    await fetchRatingReviewQueue()

    expect(mockFrom).toHaveBeenCalledWith('rating_events')
    expect(eq).toHaveBeenCalledWith('flagged', true)
    expect(is).toHaveBeenCalledWith('review_status', null)
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('throws when the query errors', async () => {
    const err = { message: 'permission denied' }
    const order = vi.fn().mockResolvedValue({ data: null, error: err })
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ is: () => ({ order }) }) }) })
    await expect(fetchRatingReviewQueue()).rejects.toBe(err)
  })
})
