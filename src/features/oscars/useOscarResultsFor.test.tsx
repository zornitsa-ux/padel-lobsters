// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../test/renderWithClient'
import { oscarKeys } from './oscarKeys'
import { useOscarResultsFor } from './useOscarResultsFor'

vi.mock('../../api/oscars', () => ({ getResults: vi.fn() }))

import { getResults } from '../../api/oscars'

const mockGetResults = getResults as ReturnType<typeof vi.fn>

const row = (categoryId: string, targetId: string) => ({
  category_id: categoryId,
  category_name: 'Best Smash',
  category_icon: '🎾',
  display_order: 1,
  target_id: targetId,
  target_name: 'Ian',
  votes_count: 3,
  rank_in_category: 1,
  total_voters: 5,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useOscarResultsFor', () => {
  it('fetches every id and keys the results by tournament id', async () => {
    mockGetResults.mockImplementation(async (id: string) => ({
      data: [row(`cat-${id}`, `p-${id}`)],
      error: null,
    }))

    const { result } = renderHookWithClient(() => useOscarResultsFor(['t1', 't2']))

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(mockGetResults).toHaveBeenCalledTimes(2)
    expect(Object.keys(result.current.byTournamentId).sort()).toEqual(['t1', 't2'])
    expect(result.current.byTournamentId.t1[0].category_id).toBe('cat-t1')
    expect(result.current.byTournamentId.t2[0].category_id).toBe('cat-t2')
    expect(result.current.isError).toBe(false)
  })

  it('shares a cache entry with oscarKeys.results(id)', async () => {
    mockGetResults.mockResolvedValue({ data: [row('cat-1', 'p-1')], error: null })

    const { result, client } = renderHookWithClient(() => useOscarResultsFor(['t1']))

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(client.getQueryData(oscarKeys.results('t1'))).toEqual([row('cat-1', 'p-1')])
  })

  it('surfaces a failed fetch as an error instead of an empty result set', async () => {
    const boom = new Error('rpc failed')
    mockGetResults.mockImplementation(async (id: string) =>
      id === 't2' ? { data: [], error: boom } : { data: [row('cat-1', 'p-1')], error: null },
    )

    const { result } = renderHookWithClient(() => useOscarResultsFor(['t1', 't2']))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.errors).toEqual([boom])
    // the healthy tournament still resolves; the failed one is absent, not empty
    expect(result.current.byTournamentId.t1).toHaveLength(1)
    expect(result.current.byTournamentId.t2).toBeUndefined()
  })

  it('issues no requests for an empty id list', async () => {
    const { result } = renderHookWithClient(() => useOscarResultsFor([]))

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(mockGetResults).not.toHaveBeenCalled()
    expect(result.current.byTournamentId).toEqual({})
  })
})
