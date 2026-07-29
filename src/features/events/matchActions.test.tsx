// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { renderHookWithClient } from '../../test/renderWithClient'
import { matchKeys } from './matchKeys'
import { useMatchActions } from './useMatches'

vi.mock('./matchQueries', () => ({
  fetchMatches: vi.fn(),
  fetchAllMatches: vi.fn(),
  saveMatches: vi.fn(),
  updateMatch: vi.fn(),
}))

vi.mock('./tournamentChannel', () => ({
  broadcastScore: vi.fn(),
  broadcastSchedule: vi.fn(),
  subscribeTournament: vi.fn(() => () => {}),
}))

import * as q from './matchQueries'
import { broadcastScore, broadcastSchedule } from './tournamentChannel'

beforeEach(() => {
  vi.clearAllMocks()
})

// The shared harness uses gcTime: 0, which collects a setQueryData-seeded
// cache the moment a timer runs — racing these optimistic-cache assertions.
const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const STAMP = '2026-07-29T19:30:00.500000+00:00'

const makeMatch = (id: string, tournamentId: string) => ({
  id,
  tournamentId,
  score1: null,
  score2: null,
  completed: false,
  updatedAt: '2026-07-29T19:00:00.000000+00:00',
})

const writeOk = (updated_at: string | null = STAMP) => ({ data: { updated_at }, error: null })

// ── saveMatches ───────────────────────────────────────────────────────────────

describe('useMatchActions — saveMatches', () => {
  it('calls the mutation, invalidates the tournament match list and tells peers', async () => {
    ;(q.saveMatches as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const client = makeClient()
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
    // Replaces the old postgres_changes INSERT/DELETE subscription.
    expect(broadcastSchedule).toHaveBeenCalledWith({ tournamentId: 'tid-1' })
  })
})

// ── updateMatch ───────────────────────────────────────────────────────────────

describe('useMatchActions — updateMatch', () => {
  it('optimistically patches the cache before the write resolves', async () => {
    let resolveWrite: (value: unknown) => void = () => {}
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve
      }),
    )

    const client = makeClient()
    client.setQueryData(matchKeys.all(), [makeMatch('match-1', 'tid-1')])

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    // Flush onMutate's microtasks without letting timers run, so the assertion
    // sees the optimistic state while the write is still in flight.
    await act(async () => {
      result.current.updateMatch('match-1', { score1: 6, score2: 3, completed: true })
    })

    const cached = client.getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.all())
    expect(cached?.[0].score1).toBe(6)
    expect(cached?.[0].completed).toBe(true)

    await act(async () => {
      resolveWrite({ data: null, error: null })
    })
  })

  it('cancels in-flight match fetches so a stale GET cannot land on the write', async () => {
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue(writeOk())

    const client = makeClient()
    client.setQueryData(matchKeys.all(), [makeMatch('match-1', 'tid-1')])
    const cancelSpy = vi.spyOn(client, 'cancelQueries')

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      result.current.updateMatch('match-1', { score1: 6, score2: 3, completed: true })
    })

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith({ queryKey: matchKeys.all() }))
  })

  it('broadcasts only the written fields and reconciles the list once settled', async () => {
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue(writeOk())

    const client = makeClient()
    client.setQueryData(matchKeys.all(), [makeMatch('match-1', 'tid-1')])
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      result.current.updateMatch('match-1', { score1: 6, score2: 3, completed: true })
    })

    // tournamentId is extracted during the optimistic cache scan; updatedAt is
    // the server's stamp, which peers use to reject older deltas.
    await waitFor(() =>
      expect(broadcastScore).toHaveBeenCalledWith({
        tournamentId: 'tid-1',
        payload: { id: 'match-1', score1: 6, score2: 3, completed: true, updatedAt: STAMP },
      }),
    )
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: matchKeys.list('tid-1') })
  })

  it("watermarks the cache with the server's stamp on success", async () => {
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue(writeOk())

    const client = makeClient()
    client.setQueryData(matchKeys.all(), [makeMatch('match-1', 'tid-1')])

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      result.current.updateMatch('match-1', { score1: 6, score2: 3, completed: true })
    })

    await waitFor(() => {
      const cached = client.getQueryData<Record<string, unknown>[]>(matchKeys.all())
      expect(cached?.[0].updatedAt).toBe(STAMP)
    })
  })

  it('rolls the cache back and does not broadcast when the write fails', async () => {
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'DB write failed' },
    })

    const client = makeClient()
    client.setQueryData(matchKeys.all(), [makeMatch('match-2', 'tid-2')])

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      result.current.updateMatch('match-2', { score1: 4, score2: 7, completed: true })
    })

    await waitFor(() => {
      const cached = client.getQueryData<ReturnType<typeof makeMatch>[]>(matchKeys.all())
      expect(cached?.[0].score1).toBeNull()
      expect(cached?.[0].completed).toBe(false)
    })
    expect(broadcastScore).not.toHaveBeenCalled()
  })

  it('does not broadcast when the match is in no cache (no tournamentId)', async () => {
    ;(q.updateMatch as ReturnType<typeof vi.fn>).mockResolvedValue(writeOk())

    const client = makeClient()
    client.setQueryData(matchKeys.all(), [])

    const { result } = renderHookWithClient(() => useMatchActions(), client)

    await act(async () => {
      result.current.updateMatch('unknown-match', { score1: 1, score2: 2, completed: true })
    })

    await waitFor(() => expect(q.updateMatch).toHaveBeenCalled())
    expect(broadcastScore).not.toHaveBeenCalled()
  })
})
