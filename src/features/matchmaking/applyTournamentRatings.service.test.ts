import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc, from: mockFrom }))

import {
  applyTournamentRatings,
  fetchRatingReviewQueue,
  reviewRatingEvent,
} from './applyTournamentRatings.service'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
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

  // `input_delta numeric DEFAULT NULL`: omitting the key and sending an
  // explicit null both resolve to NULL server-side. What must not happen is a
  // stale delta leaking into an approve.
  it('sends no delta when none is provided', async () => {
    mockRpc.mockResolvedValue({ data: row, error: null })
    await reviewRatingEvent({ eventId: 'e1', action: 'approve' })
    expect(mockRpc.mock.calls[0][1].input_delta ?? null).toBeNull()
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
