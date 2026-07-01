// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { matchKeys } from './matchKeys'
import { useMatchActions } from './useMatches'

vi.mock('./matchQueries', () => ({
  fetchMatches: vi.fn(),
  fetchAllMatches: vi.fn(),
  saveMatches: vi.fn(),
  updateMatch: vi.fn(),
}))

vi.mock('./scoreChannel', () => ({
  broadcastScore: vi.fn(),
  subscribeScores: vi.fn(() => () => {}),
}))

import * as q from './matchQueries'
import { broadcastScore } from './scoreChannel'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── saveMatches ───────────────────────────────────────────────────────────────

describe('useMatchActions — saveMatches', () => {
  it('calls the mutation and invalidates the tournament match list', async () => {
    ;(q.saveMatches as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    const rounds = [[{ team1Ids: ['a', 'b'], team2Ids: ['c', 'd'] }]]
    await act(async () => {
      await result.current.saveMatches('tid-1', rounds)
    })

    expect(q.saveMatches).toHaveBeenCalledWith('tid-1', rounds)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: matchKeys.list('tid-1'),
    })
  })
})

// ── updateMatch ───────────────────────────────────────────────────────────────

describe('useMatchActions — updateMatch', () => {
  it('optimistically patches the matching cache entry and broadcasts on success', async () => {
    const existingMatch = {
      id: 'match-1',
      tournamentId: 'tid-1',
      score1: null,
      score2: null,
      completed: false,
    }
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })

    const client = makeTestQueryClient()
    // Seed cache with a flat list under matchKeys.all() (simulating fetchAllMatches)
    client.setQueryData(matchKeys.all(), [existingMatch])
    vi.spyOn(client, 'invalidateQueries')
    const setQueriesDataSpy = vi.spyOn(client, 'setQueriesData')

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      await result.current.updateMatch('match-1', { score1: 6, score2: 3, completed: true })
    })

    // The optimistic setQueriesData was called across the matchKeys.all() key space
    expect(setQueriesDataSpy).toHaveBeenCalledWith(
      { queryKey: matchKeys.all() },
      expect.any(Function),
    )

    // Broadcast contains ONLY the written fields + the id. tournamentId is
    // extracted during the cache scan, proving the match was found in cache.
    expect(broadcastScore).toHaveBeenCalledWith({
      tournamentId: 'tid-1',
      payload: { id: 'match-1', score1: 6, score2: 3, completed: true },
    })

    // No invalidation on success
    expect(client.invalidateQueries).not.toHaveBeenCalled()
  })

  it('invalidates all matches on error instead of broadcasting', async () => {
    const existingMatch = {
      id: 'match-2',
      tournamentId: 'tid-2',
      score1: null,
      score2: null,
      completed: false,
    }
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'DB write failed' },
    })

    const client = makeTestQueryClient()
    client.setQueryData(matchKeys.all(), [existingMatch])
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      await result.current.updateMatch('match-2', { score1: 4, score2: 7, completed: true })
    })

    // Should NOT broadcast
    expect(broadcastScore).not.toHaveBeenCalled()

    // Should invalidate all matches
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: matchKeys.all(),
    })
  })

  it('does not broadcast when match is not found in any cache (no tournamentId)', async () => {
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })

    const client = makeTestQueryClient()
    // empty cache — match not found
    client.setQueryData(matchKeys.all(), [])

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      await result.current.updateMatch('unknown-match', { score1: 1, score2: 2, completed: true })
    })

    // tournamentId stays undefined → no broadcast
    expect(broadcastScore).not.toHaveBeenCalled()
  })
})
