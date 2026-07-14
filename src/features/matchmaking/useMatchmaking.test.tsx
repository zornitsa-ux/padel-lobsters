// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { matchKeys } from '../events/matchKeys'
import { playerKeys } from '../players/playerKeys'
import { matchmakingKeys } from './matchmakingKeys'

vi.mock('./generateSchedule.service', () => ({ commitSchedule: vi.fn() }))
vi.mock('./applyTournamentRatings.service', () => ({
  applyTournamentRatings: vi.fn(),
  reviewRatingEvent: vi.fn(),
  fetchRatingReviewQueue: vi.fn(),
}))

import { commitSchedule } from './generateSchedule.service'
import {
  applyTournamentRatings,
  reviewRatingEvent,
  fetchRatingReviewQueue,
} from './applyTournamentRatings.service'
import {
  useApplyTournamentRatings,
  useCommitSchedule,
  useRatingReviewQueue,
  useReviewRatingEvent,
} from './useMatchmaking'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  asMock(commitSchedule).mockResolvedValue({ runId: 'r1' })
  asMock(applyTournamentRatings).mockResolvedValue(3)
  asMock(reviewRatingEvent).mockResolvedValue({})
  asMock(fetchRatingReviewQueue).mockResolvedValue([])
})

describe('useCommitSchedule', () => {
  it('invalidates the tournament matches + schedule-run history on success', async () => {
    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHookWithClient(() => useCommitSchedule(), client)

    await act(async () => {
      await result.current.mutateAsync({ run: { tournamentId: 't1' } as never })
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: matchKeys.list('t1') })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: matchmakingKeys.scheduleRuns('t1'),
    })
  })
})

describe('useApplyTournamentRatings', () => {
  it('invalidates the review queue and players on success', async () => {
    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHookWithClient(() => useApplyTournamentRatings(), client)

    await act(async () => {
      await result.current.mutateAsync({ tournament_id: 't1', updates: [] })
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: matchmakingKeys.reviewQueue(),
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})

describe('useReviewRatingEvent', () => {
  it('invalidates the review queue and players on success', async () => {
    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHookWithClient(() => useReviewRatingEvent(), client)

    await act(async () => {
      await result.current.mutateAsync({ eventId: 'e1', action: 'discard' })
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: matchmakingKeys.reviewQueue(),
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})

describe('useRatingReviewQueue', () => {
  it('reads through fetchRatingReviewQueue under the review-queue key', async () => {
    const { result } = renderHookWithClient(() => useRatingReviewQueue())
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchRatingReviewQueue).toHaveBeenCalled()
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
