// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { matchKeys } from './matchKeys'
import { useRecentMatches, recentMatchesSince, RECENT_MATCH_WINDOW_DAYS } from './useMatches'

vi.mock('./matchQueries', () => ({
  fetchMatches: vi.fn(),
  fetchAllMatches: vi.fn(),
  fetchRecentMatches: vi.fn(),
}))

import { fetchRecentMatches } from './matchQueries'

const mockRows = [{ id: 'm1', tournamentId: 't1' }]

beforeEach(() => {
  vi.clearAllMocks()
  ;(fetchRecentMatches as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows)
})

describe('recentMatchesSince', () => {
  it('returns a bare day, so the query key is stable within a day', () => {
    const noon = Date.parse('2026-08-07T12:00:00Z')
    const midnight = Date.parse('2026-08-07T23:59:00Z')
    expect(recentMatchesSince(noon)).toBe('2026-07-31')
    expect(recentMatchesSince(midnight)).toBe(recentMatchesSince(noon))
  })

  it('reaches back further than the 48h window the completed banners use', () => {
    // Dashboard's TWO_DAYS_MS. A banner rendered for a tournament inside that
    // window must find its matches in this fetch, or it scores an empty set.
    expect(RECENT_MATCH_WINDOW_DAYS).toBeGreaterThan(2)
  })
})

describe('useRecentMatches', () => {
  it('fetches the window and caches it under a matches-prefixed key', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHookWithClient(() => useRecentMatches(), client)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const since = recentMatchesSince()
    expect(fetchRecentMatches).toHaveBeenCalledWith(since)
    expect(result.current.data).toEqual(mockRows)
    // The prefix is what lets optimistic score patches aimed at matchKeys.all()
    // reach this cache too.
    expect(matchKeys.recent(since)[0]).toBe(matchKeys.all()[0])
    expect(client.getQueryData(matchKeys.recent(since))).toEqual(mockRows)
  })

  it('is reached by a setQueriesData patch targeting every match cache', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHookWithClient(() => useRecentMatches(), client)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    client.setQueriesData<typeof mockRows>({ queryKey: matchKeys.all() }, (cache) =>
      (cache ?? []).map((m) => ({ ...m, tournamentId: 'patched' })),
    )

    expect(client.getQueryData(matchKeys.recent(recentMatchesSince()))).toEqual([
      { id: 'm1', tournamentId: 'patched' },
    ])
  })
})
