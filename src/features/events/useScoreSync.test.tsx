// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useScoreSync } from './useScoreSync'
import { subscribeScores } from './scoreChannel'
import { matchKeys } from './matchKeys'
import type { ScorePayload } from './scoreChannel'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// vi.hoisted makes mockUnsubscribe available inside the vi.mock factory below.
const mockUnsubscribe = vi.hoisted(() => vi.fn())

vi.mock('./scoreChannel', () => ({
  subscribeScores: vi.fn(() => mockUnsubscribe),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatch(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tournamentId: 't1',
    round: 1,
    court: null,
    team1Ids: [],
    team2Ids: [],
    team1Level: 0,
    team2Level: 0,
    score1: null,
    score2: null,
    completed: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useScoreSync', () => {
  let queryClient: QueryClient

  // Defined here so each test renders into the same queryClient instance that
  // beforeEach assigns.  Captured by reference so the reset in beforeEach
  // is visible to any wrapper created during the test.
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterEach(() => {
    queryClient.clear()
    vi.useRealTimers()
  })

  // Convenience: pull the onScore callback that the hook passed to subscribeScores.
  function getOnScore(): (payload: ScorePayload) => void {
    return vi.mocked(subscribeScores).mock.calls[0][0].onScore
  }

  // ── Guard conditions ────────────────────────────────────────────────────

  it('does not call subscribeScores when enabled=false', () => {
    renderHook(() => useScoreSync({ tournamentId: 't1', enabled: false }), { wrapper: Wrapper })
    expect(subscribeScores).not.toHaveBeenCalled()
  })

  it('does not call subscribeScores when tournamentId is null', () => {
    renderHook(() => useScoreSync({ tournamentId: null }), { wrapper: Wrapper })
    expect(subscribeScores).not.toHaveBeenCalled()
  })

  it('does not call subscribeScores when tournamentId is undefined', () => {
    renderHook(() => useScoreSync({ tournamentId: undefined }), { wrapper: Wrapper })
    expect(subscribeScores).not.toHaveBeenCalled()
  })

  // ── Happy path: subscription ─────────────────────────────────────────────

  it('subscribes to the tournament channel when enabled with a valid id', () => {
    renderHook(() => useScoreSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    expect(subscribeScores).toHaveBeenCalledOnce()
    expect(subscribeScores).toHaveBeenCalledWith(expect.objectContaining({ tournamentId: 't1' }))
  })

  // ── Coalescing timer ────────────────────────────────────────────────────

  it('coalesces multiple rapid onScore calls into a single cache write after 250 ms', () => {
    const matches = [makeMatch('m1', { score1: 0 }), makeMatch('m2', { score1: 0 })]
    // matchKeys.list key is ['matches','list','t1'] which is prefixed by
    // matchKeys.all() = ['matches'], so setQueriesData(['matches'],...) hits it.
    queryClient.setQueryData(matchKeys.list('t1'), matches)

    renderHook(() => useScoreSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    const onScore = getOnScore()

    // Two rapid updates — the coalescing timer resets on each call.
    act(() => {
      onScore({ id: 'm1', score1: 1 })
      onScore({ id: 'm1', score1: 2 })
    })

    // Cache is still stale before the timer fires.
    const before = queryClient.getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.list('t1'))
    expect(before?.find((m) => m.id === 'm1')?.score1).toBe(0)

    // Advance past the coalescing window → flush runs once.
    act(() => {
      vi.advanceTimersByTime(250)
    })

    const after = queryClient.getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.list('t1'))
    // Last delta wins (score1: 2).
    expect(after?.find((m) => m.id === 'm1')?.score1).toBe(2)
    // Unrelated match is untouched.
    expect(after?.find((m) => m.id === 'm2')?.score1).toBe(0)
  })

  it('delta merges by id — only the targeted match is changed', () => {
    const matches = [makeMatch('m1', { score1: 0 }), makeMatch('m2', { score1: 5 })]
    queryClient.setQueryData(matchKeys.list('t1'), matches)

    renderHook(() => useScoreSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    const onScore = getOnScore()

    act(() => {
      onScore({ id: 'm1', score1: 7 })
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })

    const result = queryClient.getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.list('t1'))
    expect(result?.find((m) => m.id === 'm1')?.score1).toBe(7) // updated
    expect(result?.find((m) => m.id === 'm2')?.score1).toBe(5) // unchanged
  })

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  it('clears the pending timer and calls unsubscribe on unmount', () => {
    const matches = [makeMatch('m1', { score1: 0 })]
    queryClient.setQueryData(matchKeys.list('t1'), matches)

    const { unmount } = renderHook(() => useScoreSync({ tournamentId: 't1' }), {
      wrapper: Wrapper,
    })
    const onScore = getOnScore()

    // Start the coalescing timer.
    act(() => {
      onScore({ id: 'm1', score1: 99 })
    })

    // Unmount before the 250 ms window expires.
    act(() => {
      unmount()
    })

    expect(mockUnsubscribe).toHaveBeenCalledOnce()

    // Advance past the window — flush must NOT run because timer was cleared.
    act(() => {
      vi.advanceTimersByTime(250)
    })

    const result = queryClient.getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.list('t1'))
    // Score unchanged because flush was suppressed.
    expect(result?.find((m) => m.id === 'm1')?.score1).toBe(0)
  })
})
