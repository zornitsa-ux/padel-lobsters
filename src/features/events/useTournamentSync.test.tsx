// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useTournamentSync } from './useTournamentSync'
import { subscribeTournament } from './tournamentChannel'
import { matchKeys } from './matchKeys'
import type { ScorePayload } from './tournamentChannel'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// vi.hoisted makes mockUnsubscribe available inside the vi.mock factory below.
const mockUnsubscribe = vi.hoisted(() => vi.fn())

vi.mock('./tournamentChannel', () => ({
  subscribeTournament: vi.fn(() => mockUnsubscribe),
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

describe('useTournamentSync', () => {
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

  // Convenience: pull the onScore callback that the hook passed to subscribeTournament.
  function getOnScore(): (payload: ScorePayload) => void {
    return vi.mocked(subscribeTournament).mock.calls[0][0].onScore!
  }

  // ── Guard conditions ────────────────────────────────────────────────────

  it('does not call subscribeTournament when enabled=false', () => {
    renderHook(() => useTournamentSync({ tournamentId: 't1', enabled: false }), {
      wrapper: Wrapper,
    })
    expect(subscribeTournament).not.toHaveBeenCalled()
  })

  it('does not call subscribeTournament when tournamentId is null', () => {
    renderHook(() => useTournamentSync({ tournamentId: null }), { wrapper: Wrapper })
    expect(subscribeTournament).not.toHaveBeenCalled()
  })

  it('does not call subscribeTournament when tournamentId is undefined', () => {
    renderHook(() => useTournamentSync({ tournamentId: undefined }), { wrapper: Wrapper })
    expect(subscribeTournament).not.toHaveBeenCalled()
  })

  // ── Happy path: subscription ─────────────────────────────────────────────

  it('subscribes to the tournament channel when enabled with a valid id', () => {
    renderHook(() => useTournamentSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    expect(subscribeTournament).toHaveBeenCalledOnce()
    expect(subscribeTournament).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: 't1' }),
    )
  })

  // ── Coalescing timer ────────────────────────────────────────────────────

  it('coalesces multiple rapid onScore calls into a single cache write after 250 ms', () => {
    const matches = [makeMatch('m1', { score1: 0 }), makeMatch('m2', { score1: 0 })]
    // matchKeys.list key is ['matches','list','t1'] which is prefixed by
    // matchKeys.all() = ['matches'], so setQueriesData(['matches'],...) hits it.
    queryClient.setQueryData(matchKeys.list('t1'), matches)

    renderHook(() => useTournamentSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    const onScore = getOnScore()

    // Two rapid updates inside one coalescing window.
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

  // The window is leading-edge, so a stream arriving faster than 250 ms still
  // flushes. A resetting debounce would starve here and never write.
  it('flushes on schedule under a stream arriving faster than the window', () => {
    queryClient.setQueryData(matchKeys.list('t1'), [makeMatch('m1', { score1: 0 })])

    renderHook(() => useTournamentSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    const onScore = getOnScore()
    const score1Of = () =>
      queryClient
        .getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.list('t1'))
        ?.find((m) => m.id === 'm1')?.score1

    // A delta every 100 ms for 1s — never a 250 ms gap to close the window.
    act(() => {
      for (let i = 1; i <= 10; i++) {
        onScore({ id: 'm1', score1: i })
        vi.advanceTimersByTime(100)
      }
    })

    // Deltas 1-3 landed in the first window; the stream did not starve the flush.
    expect(score1Of()).toBeGreaterThan(0)

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(score1Of()).toBe(10)
  })

  it('delta merges by id — only the targeted match is changed', () => {
    const matches = [makeMatch('m1', { score1: 0 }), makeMatch('m2', { score1: 5 })]
    queryClient.setQueryData(matchKeys.list('t1'), matches)

    renderHook(() => useTournamentSync({ tournamentId: 't1' }), { wrapper: Wrapper })
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

  // ── Monotonic guard (D) ─────────────────────────────────────────────────
  //
  // Broadcast delivery is neither ordered nor deduplicated, so a delta must be
  // rejected unless it is strictly newer than the watermark already held.

  const OLD = '2026-07-29T19:00:00.000000+00:00'
  const NEW = '2026-07-29T19:30:00.000000+00:00'

  function flushDelta(delta: Parameters<ReturnType<typeof getOnScore>>[0]) {
    act(() => {
      getOnScore()(delta)
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
  }

  function seedAndRender(overrides: Record<string, unknown>) {
    queryClient.setQueryData(matchKeys.list('t1'), [makeMatch('m1', overrides)])
    renderHook(() => useTournamentSync({ tournamentId: 't1' }), { wrapper: Wrapper })
  }

  const scoreOf = (id = 'm1') =>
    queryClient
      .getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.list('t1'))
      ?.find((m) => m.id === id)?.score1

  it('applies a delta newer than the cached watermark', () => {
    seedAndRender({ score1: 1, updatedAt: OLD })
    flushDelta({ id: 'm1', score1: 9, updatedAt: NEW })
    expect(scoreOf()).toBe(9)
  })

  it('drops a delta older than the cached watermark', () => {
    seedAndRender({ score1: 1, updatedAt: NEW })
    flushDelta({ id: 'm1', score1: 9, updatedAt: OLD })
    expect(scoreOf()).toBe(1)
  })

  it('drops a duplicate delta carrying the same watermark', () => {
    seedAndRender({ score1: 1, updatedAt: NEW })
    flushDelta({ id: 'm1', score1: 9, updatedAt: NEW })
    expect(scoreOf()).toBe(1)
  })

  it('applies a delta with no watermark — a client on the previous deploy', () => {
    seedAndRender({ score1: 1, updatedAt: NEW })
    flushDelta({ id: 'm1', score1: 9 })
    expect(scoreOf()).toBe(9)
  })

  it('applies a delta when the cached row has never been stamped', () => {
    seedAndRender({ score1: 1, updatedAt: null })
    flushDelta({ id: 'm1', score1: 9, updatedAt: OLD })
    expect(scoreOf()).toBe(9)
  })

  it('advances the watermark so a replay of the superseded delta is rejected', () => {
    seedAndRender({ score1: 1, updatedAt: OLD })
    flushDelta({ id: 'm1', score1: 9, updatedAt: NEW })
    flushDelta({ id: 'm1', score1: 4, updatedAt: OLD })
    expect(scoreOf()).toBe(9)
  })

  // ── Schedule event ──────────────────────────────────────────────────────

  it('invalidates the tournament match list when a peer rewrites the schedule', () => {
    renderHook(() => useTournamentSync({ tournamentId: 't1' }), { wrapper: Wrapper })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const onSchedule = vi.mocked(subscribeTournament).mock.calls[0][0].onSchedule!
    act(() => {
      onSchedule()
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: matchKeys.list('t1') })
  })

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  it('clears the pending timer and calls unsubscribe on unmount', () => {
    const matches = [makeMatch('m1', { score1: 0 })]
    queryClient.setQueryData(matchKeys.list('t1'), matches)

    const { unmount } = renderHook(() => useTournamentSync({ tournamentId: 't1' }), {
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
