// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

vi.mock('./useMatches', () => ({ useMatches: () => ({ data: [], isPending: false }) }))
vi.mock('../oscars/useOscarsSessionRow', () => ({ useOscarsSessionRow: () => ({ data: null }) }))
vi.mock('./teams/useTeams', () => ({
  useEventTeams: () => ({ data: [], isPending: false }),
}))

const { useEventPhase } = await import('./useEventPhase')

// 10:00 start, 60 minutes: over at 11:00 local on 15 Nov.
const kotc = {
  id: 'e1',
  status: 'upcoming',
  format: 'king_of_court',
  date: '2026-11-15',
  time: '10:00',
  duration: 60,
  resultsSharedAt: null,
  startingCourtsPublishedAt: '2026-11-15T08:00:00Z',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 15, 10, 58))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useEventPhase — King of the Court clock', () => {
  it('moves from live to social at the scheduled end on a page left open', () => {
    const { result } = renderHook(() => useEventPhase(kotc))
    expect(result.current.phase).toBe('live')

    act(() => {
      vi.advanceTimersByTime(3 * 60_000)
    })

    expect(result.current.phase).toBe('social')
  })
})
