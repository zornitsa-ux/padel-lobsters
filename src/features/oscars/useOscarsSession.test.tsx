// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../test/renderWithClient'
import { oscarKeys } from './oscarKeys'
import { useOscarResults } from './useOscarResults'
import { useOscarsSession } from './useOscarsSession'
import type { NormalisedTournament } from '../../lib/normalise'

// Mocked at the api boundary (not at useOscarsSessionRow / useOscarResults) so
// the real query hooks run and the assertions below exercise the cache keys
// those reads share with Scores, History and the registration results banner.
vi.mock('../../api/oscars', () => ({
  loadSession: vi.fn(),
  loadCategories: vi.fn(),
  getMyVotes: vi.fn(),
  getResults: vi.fn(),
  adminGetStats: vi.fn(),
  adminGetResults: vi.fn(),
  adminGetCategoryVoters: vi.fn(),
  castVote: vi.fn(),
  clearVote: vi.fn(),
  adminUpsertCategories: vi.fn(),
  adminStart: vi.fn(),
  adminEnd: vi.fn(),
  adminShare: vi.fn(),
}))

const { mockSession, mockPlayers, mockRegistrations, mockMatches } = vi.hoisted(() => ({
  mockSession: { user: { id: 'p1', app_metadata: { role: 'player' } } },
  mockPlayers: [
    { id: 'p1', name: 'Ada Lovelace' },
    { id: 'p2', name: 'Grace Hopper' },
  ],
  mockRegistrations: [
    { playerId: 'p1', status: 'registered' },
    { playerId: 'p2', status: 'registered' },
  ],
  mockMatches: [
    { round: 1, team1Ids: ['p1', 'p2'], team2Ids: ['p3', 'p4'] },
    { round: 2, team1Ids: ['p1', 'p3'], team2Ids: ['p2', 'p4'] },
  ],
}))

vi.mock('../../context/useApp', () => ({ useApp: () => ({ session: mockSession }) }))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: mockPlayers }) }))
vi.mock('../events/useRegistrations', () => ({
  useRegistrations: () => ({ data: mockRegistrations }),
}))
vi.mock('../events/useMatches', () => ({ useMatches: () => ({ data: mockMatches }) }))

import { loadSession, loadCategories, getMyVotes, getResults } from '../../api/oscars'

const mockLoadSession = vi.mocked(loadSession)
const mockLoadCategories = vi.mocked(loadCategories)
const mockGetMyVotes = vi.mocked(getMyVotes)
const mockGetResults = vi.mocked(getResults)

const tournament: NormalisedTournament = {
  id: 't1',
  name: 'Summer Open',
  date: '2026-07-01',
  time: '18:00',
  location: 'Amsterdam',
  status: 'completed',
  format: 'americano',
  notes: '',
  maxPlayers: 16,
  duration: 90,
  courts: [],
  totalPrice: 0,
  tikkieLink: '',
  genderMode: 'mixed',
  completedAt: null,
  resultsSharedAt: null,
  rafflePublishedAt: null,
}

const sessionRow = {
  id: 's1',
  started_at: '2026-07-01T10:00:00Z',
  closed_at: null,
  shared_at: null,
}

const resultRow = {
  category_id: 'c1',
  category_name: 'Best Lobster',
  category_icon: '🦞',
  display_order: 0,
  target_id: 'p2',
  target_name: 'Grace Hopper',
  votes_count: 3,
  rank_in_category: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLoadSession.mockResolvedValue({ data: sessionRow, error: null })
  mockLoadCategories.mockResolvedValue({ data: [], error: null })
  mockGetMyVotes.mockResolvedValue({ data: [], error: null })
  mockGetResults.mockResolvedValue({ data: [resultRow], error: null })
})

describe('useOscarsSession', () => {
  it('reads the session row through the shared oscarKeys.session cache entry', async () => {
    const { result, client } = renderHookWithClient(() => useOscarsSession(tournament))

    expect(result.current.phase).toBe('loading')
    await waitFor(() => expect(result.current.phase).toBe('active'))
    expect(client.getQueryData(oscarKeys.session('t1'))).toEqual(sessionRow)
    expect(mockLoadSession).toHaveBeenCalledTimes(1)
  })

  it('treats a failed session read as an error, not as "no session"', async () => {
    mockLoadSession.mockResolvedValue({ data: null, error: new Error('network down') })

    const { result } = renderHookWithClient(() => useOscarsSession(tournament))

    await waitFor(() =>
      expect(result.current.error).toBe('Could not load session — please refresh.'),
    )
    expect(result.current.phase).toBe('not_created')
  })

  it('reports "loading" and fetches nothing without a tournament', () => {
    const { result } = renderHookWithClient(() => useOscarsSession(null))

    expect(result.current.phase).toBe('loading')
    expect(mockLoadSession).not.toHaveBeenCalled()
  })

  it('leaves the published results unfetched until the container asks for them', async () => {
    const { result } = renderHookWithClient(() => useOscarsSession(tournament))

    await waitFor(() => expect(result.current.phase).toBe('active'))
    expect(result.current.playerResults).toBeNull()
    expect(mockGetResults).not.toHaveBeenCalled()
  })

  it('shares one oscarKeys.results entry with useOscarResults once asked', async () => {
    const { result, client } = renderHookWithClient(() => ({
      oscars: useOscarsSession(tournament),
      shared: useOscarResults('t1'),
    }))

    await waitFor(() => expect(result.current.oscars.phase).toBe('active'))
    await act(async () => {
      await result.current.oscars.loadPlayerResults()
    })

    await waitFor(() => expect(result.current.oscars.playerResults).toEqual([resultRow]))
    expect(result.current.shared.data).toEqual([resultRow])
    expect(client.getQueryData(oscarKeys.results('t1'))).toEqual([resultRow])
    // One cache entry rather than a second per-feature key that would drift.
    expect(client.getQueryCache().findAll({ queryKey: oscarKeys.results('t1') })).toHaveLength(1)
  })

  it('surfaces a failed results read instead of rendering an empty result set', async () => {
    mockGetResults.mockResolvedValue({ data: [], error: new Error('boom') })

    const { result } = renderHookWithClient(() => useOscarsSession(tournament))

    await waitFor(() => expect(result.current.phase).toBe('active'))
    await act(async () => {
      await result.current.loadPlayerResults()
    })

    await waitFor(() =>
      expect(result.current.error).toBe('Could not load results — please refresh.'),
    )
    expect(result.current.playerResults).toBeNull()
  })

  it('maps the shared matches cache into the head-to-head shape', async () => {
    const { result } = renderHookWithClient(() => useOscarsSession(tournament))

    await waitFor(() => expect(result.current.phase).toBe('active'))
    expect(result.current.matches).toEqual([
      { round: 1, team1_ids: ['p1', 'p2'], team2_ids: ['p3', 'p4'] },
      { round: 2, team1_ids: ['p1', 'p3'], team2_ids: ['p2', 'p4'] },
    ])
  })

  it('indexes the viewer’s own votes by category', async () => {
    mockGetMyVotes.mockResolvedValue({
      data: [{ category_id: 'c1', target_id: 'p2', target_name: 'Grace Hopper' }],
      error: null,
    })

    const { result } = renderHookWithClient(() => useOscarsSession(tournament))

    await waitFor(() =>
      expect(result.current.myVoteByCat).toEqual({ c1: { id: 'p2', name: 'Grace Hopper' } }),
    )
  })

  it('exposes only the registered players, with disambiguated short names', async () => {
    const { result } = renderHookWithClient(() => useOscarsSession(tournament))

    await waitFor(() => expect(result.current.phase).toBe('active'))
    expect(result.current.regPlayers.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(result.current.shortName(mockPlayers[1])).toBe('Grace')
    expect(result.current.amRegistered).toBe(true)
  })
})
