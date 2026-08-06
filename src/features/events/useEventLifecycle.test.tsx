// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

/* ════════════════════════════════════════════════════════════════════════════
   These assertions moved here from Schedule.test.tsx when Finish, Reveal and
   the flagged-rating review left the Schedule tab for the run-of-show. The
   behaviours are unchanged and deliberately still pinned — the double-apply
   dead-end and the stranded-review-queue cases were both owner-reported bugs
   (2026-07-25) and are easy to reintroduce.
   ════════════════════════════════════════════════════════════════════════════ */

const mockApplyMutateAsync = vi.fn()
const mockReviewMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()
const mockUseRatingReviewQueue = vi.fn()
const mockUseMmRatings = vi.fn()

vi.mock('./useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: mockUpdateMutateAsync }),
}))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('./useMatches', () => ({ useMatches: () => ({ data: savedMatches }) }))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({
    data: players.map((p) => ({ playerId: p.id, status: 'registered' })),
  }),
}))
vi.mock('../matchmaking/useMatchmaking', () => ({
  useApplyTournamentRatings: () => ({ mutateAsync: mockApplyMutateAsync }),
  useReviewRatingEvent: () => ({ mutateAsync: mockReviewMutateAsync, isPending: false }),
  useRatingReviewQueue: () => mockUseRatingReviewQueue(),
  useMmRatings: () => mockUseMmRatings(),
}))

const { useEventLifecycle } = await import('./useEventLifecycle')

const players = Array.from({ length: 4 }, (_, i) => ({
  id: `p${i}`,
  name: `Player ${i}`,
  playtomicLevel: 3,
}))

const scoredMatches = [
  {
    id: 'm1',
    round: 1,
    team1Ids: ['p0', 'p1'],
    team2Ids: ['p2', 'p3'],
    completed: true,
    score1: 21,
    score2: 15,
  },
]

let savedMatches: unknown[] = scoredMatches

const tournament = {
  id: 't1',
  name: 'Friday Padel',
  status: 'active',
  resultsSharedAt: null,
  rafflePublishedAt: null,
} as never

const flaggedRow = {
  id: 'evt1',
  kind: 'tournament',
  tournament_id: 't1',
  player_id: 'p0',
  prior_mu: 3.5,
  prior_sigma: 0.45,
  proposed_delta: 0.5,
  applied_delta: 0.3,
  flagged: true,
  review_status: null,
  reviewed_by: null,
  reviewed_at: null,
  breakdown: [],
  created_at: '2026-07-24T00:00:00.000Z',
}

const render = (t = tournament) => renderHook(() => useEventLifecycle({ tournament: t }))

beforeEach(() => {
  savedMatches = scoredMatches
  mockApplyMutateAsync.mockReset().mockResolvedValue(undefined)
  mockReviewMutateAsync.mockReset().mockResolvedValue(undefined)
  mockUpdateMutateAsync.mockReset().mockResolvedValue(undefined)
  mockUseRatingReviewQueue.mockReturnValue({ data: [] })
  mockUseMmRatings.mockReturnValue({ data: {} })
})
afterEach(cleanup)

describe('finishTournament — applies ratings before marking complete', () => {
  it('DEFECT GUARD — applies learned ratings, then sets status completed', async () => {
    // The Info tab's deleted button wrote status without this apply step, which
    // silently stranded the event's learned ratings forever.
    const { result } = render()

    await act(async () => {
      await result.current.finishTournament()
    })

    expect(mockApplyMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: expect.objectContaining({ status: 'completed' }),
    })
  })

  it('applies ratings BEFORE the status write, so a failure leaves it finishable', async () => {
    const order: string[] = []
    mockApplyMutateAsync.mockImplementation(async () => void order.push('apply'))
    mockUpdateMutateAsync.mockImplementation(async () => void order.push('complete'))
    const { result } = render()

    await act(async () => {
      await result.current.finishTournament()
    })

    expect(order).toEqual(['apply', 'complete'])
  })

  it('sets completedAt alongside status', async () => {
    const { result } = render()

    await act(async () => {
      await result.current.finishTournament()
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: { status: 'completed', completedAt: expect.any(String) },
    })
  })
})

describe('finishTournament — double-apply guard dead-end (owner ask, 2026-07-25)', () => {
  it('treats a double-apply-guard rejection as done and still completes', async () => {
    // A prior Finish can apply ratings and then fail the status write; the RPC's
    // guard then rejects every retry's apply step. Without this, completion was
    // permanently blocked with nothing left to apply.
    mockApplyMutateAsync.mockRejectedValue(new Error('ratings already applied for tournament t1'))
    const { result } = render()

    await act(async () => {
      await result.current.finishTournament()
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: expect.objectContaining({ status: 'completed' }),
    })
    expect(result.current.error).toBe('')
  })

  it('still aborts on a genuine apply failure and does not mark completed', async () => {
    mockApplyMutateAsync.mockRejectedValue(new Error('network error'))
    const { result } = render()

    await act(async () => {
      await result.current.finishTournament()
    })

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
    expect(result.current.error).toMatch(/network error/i)
  })

  it('reports failure to the caller', async () => {
    mockApplyMutateAsync.mockRejectedValue(new Error('network error'))
    const { result } = render()

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.finishTournament()
    })

    expect(ok).toBe(false)
  })
})

describe('reviewQueue — stranded rating reviews (owner ask, 2026-07-25)', () => {
  it('re-derives the queue on mount from unresolved flagged rating_events', () => {
    // Not just post-Finish component state: a flagged row stays unresolved until
    // an admin acts, so it must survive a navigate-away or refresh.
    mockUseRatingReviewQueue.mockReturnValue({ data: [flaggedRow] })
    const { result } = render()

    expect(result.current.reviewQueue).toHaveLength(1)
    expect(result.current.reviewQueue[0].id).toBe('evt1')
  })

  it('filters the queue to the current tournament', () => {
    mockUseRatingReviewQueue.mockReturnValue({
      data: [{ ...flaggedRow, id: 'evt-other', tournament_id: 'some-other-tournament' }],
    })
    const { result } = render()

    expect(result.current.reviewQueue).toEqual([])
  })

  it('is empty when nothing is flagged', () => {
    mockUseRatingReviewQueue.mockReturnValue({ data: [] })
    const { result } = render()

    expect(result.current.reviewQueue).toEqual([])
  })

  it('exposes registered player names for the review card', () => {
    const { result } = render()

    expect(result.current.playerNamesById).toMatchObject({ p0: 'Player 0' })
  })
})

describe('revealResults (D-029)', () => {
  it('writes resultsSharedAt and nothing else', async () => {
    const { result } = render()

    await act(async () => {
      await result.current.revealResults()
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: { resultsSharedAt: expect.any(String) },
    })
  })

  it('DEFECT GUARD — reveals with an unresolved flag queue present', async () => {
    mockUseRatingReviewQueue.mockReturnValue({ data: [flaggedRow] })
    const { result } = render()

    await act(async () => {
      await result.current.revealResults()
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: { resultsSharedAt: expect.any(String) },
    })
    expect(result.current.error).toBe('')
  })

  it('surfaces the underlying reveal failure, not a generic fallback', async () => {
    mockUpdateMutateAsync.mockRejectedValue(new Error('offline'))
    const { result } = render()

    await act(async () => {
      await result.current.revealResults()
    })

    expect(result.current.error).toBe('offline')
  })
})

describe('publishRaffleWinners', () => {
  it('writes rafflePublishedAt only', async () => {
    const { result } = render()

    await act(async () => {
      await result.current.publishRaffleWinners()
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: { rafflePublishedAt: expect.any(String) },
    })
  })

  it('is independent of the standings reveal', async () => {
    const { result } = render()

    await act(async () => {
      await result.current.publishRaffleWinners()
    })

    const [[payload]] = mockUpdateMutateAsync.mock.calls
    expect(payload.data).not.toHaveProperty('resultsSharedAt')
  })

  it('surfaces the underlying publish failure', async () => {
    mockUpdateMutateAsync.mockRejectedValue(new Error('offline'))
    const { result } = render()

    await act(async () => {
      await result.current.publishRaffleWinners()
    })

    expect(result.current.error).toBe('offline')
  })
})
