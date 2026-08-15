// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect, useState } from 'react'
import { waitFor, fireEvent, act } from '@testing-library/react'
import {
  renderHookWithClient,
  renderWithClient,
  makeTestQueryClient,
} from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'
import { playerPiiKeys } from './playerKeys'
import { useRevealPii } from '../community/useRevealPii'

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  // Empty roster by default — the useMyProfile/useForgetPlayerPii tests below
  // only care about the PII overlay, not roster identity merging.
  mockFrom: vi.fn(() => ({
    select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
  })),
}))
vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc, from: mockFrom }))

import { fetchPlayerPii } from './playerQueries'
import { usePlayerPii, useEnsurePlayerPii, useMyProfile } from './usePlayers'

const row = {
  id: 'p1',
  email: 'ada@example.com',
  phone: '+3161234567',
  birthday: '1990-12-10',
  notes: 'plays left',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchPlayerPii', () => {
  it('requests exactly the given player id, not the whole roster', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })

    await expect(fetchPlayerPii('p1')).resolves.toEqual({
      email: 'ada@example.com',
      phone: '+3161234567',
      birthday: '1990-12-10',
      notes: 'plays left',
    })
    expect(mockRpc).toHaveBeenCalledWith('admin_get_player_pii', { input_target_id: 'p1' })
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('normalises missing columns to empty strings, not undefined', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'p2' }], error: null })

    await expect(fetchPlayerPii('p2')).resolves.toEqual({
      email: '',
      phone: '',
      birthday: '',
      notes: '',
    })
  })

  it('propagates the RPC error instead of resolving to blanks', async () => {
    const err = { message: 'permission denied for function' }
    mockRpc.mockResolvedValue({ data: null, error: err })

    await expect(fetchPlayerPii('p1')).rejects.toBe(err)
  })

  // The load-bearing invariant this whole redesign exists to preserve: a
  // missing/absent row must never be indistinguishable from "no PII".
  it('throws when the RPC returns no row for the id', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await expect(fetchPlayerPii('does-not-exist')).rejects.toThrow()
  })
})

describe('usePlayerPii', () => {
  it('does not fetch until enabled is true', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })

    const { result } = renderHookWithClient(() => usePlayerPii({ id: 'p1', enabled: false }))

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('caches under a per-player key, not a shared roster-wide key', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })

    const { result, client } = renderHookWithClient(() => usePlayerPii({ id: 'p1', enabled: true }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData(playerPiiKeys.detail('p1'))).toEqual(result.current.data)
    expect(client.getQueryData(playerPiiKeys.detail('p2'))).toBeUndefined()
  })

  it('surfaces a failed read as an error rather than as "no contact details"', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHookWithClient(() => usePlayerPii({ id: 'p1', enabled: true }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('useEnsurePlayerPii', () => {
  it('resolves with exactly the requested player and rejects on failure', async () => {
    mockRpc.mockResolvedValueOnce({ data: [row], error: null })
    const { result } = renderHookWithClient(() => useEnsurePlayerPii())
    await expect(result.current('p1')).resolves.toEqual({
      email: 'ada@example.com',
      phone: '+3161234567',
      birthday: '1990-12-10',
      notes: 'plays left',
    })

    // Different id — 'p1' is now cached and fresh (staleTime), so a second
    // call for it would resolve from cache rather than hitting the RPC.
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'nope' } })
    await expect(result.current('p2')).rejects.toBeTruthy()
  })

  // Finding 3: ensureQueryData defaults to revalidateIfStale: false, so an
  // admin_update_player write that invalidates this player's PII query used
  // to have no effect on a subsequent ensureQueryData call — reopening Edit
  // right after a save would silently re-seed the form from pre-write PII.
  it('refetches instead of serving stale cache once the query has been invalidated', async () => {
    const client = makeTestQueryClient()
    mockRpc.mockResolvedValueOnce({ data: [row], error: null })
    const { result } = renderHookWithClient(() => useEnsurePlayerPii(), client)

    await expect(result.current('p1')).resolves.toMatchObject({ email: 'ada@example.com' })
    expect(mockRpc).toHaveBeenCalledTimes(1)

    // Mirrors what usePlayerActions.updatePlayer does after a successful write.
    await client.invalidateQueries({ queryKey: playerPiiKeys.detail('p1') })

    const updatedRow = { ...row, email: 'ada2@example.com' }
    mockRpc.mockResolvedValueOnce({ data: [updatedRow], error: null })
    // revalidateIfStale kicks off a background refetch but (per TanStack's
    // own ensureQueryData) still resolves THIS call with the stale cached
    // value — the fetch count and the cache afterwards are what prove the
    // refetch actually happened, which is the behaviour the fix restores.
    await result.current('p1')
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2))
    expect(client.getQueryData(playerPiiKeys.detail('p1'))).toMatchObject({
      email: 'ada2@example.com',
    })
  })
})

describe('useMyProfile — hasPii (finding 1)', () => {
  it('is false when the profile RPC succeeds but returns no row', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHookWithClient(() => useMyProfile('p1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasPii).toBe(false)
    await waitFor(() => expect(result.current.piiUnavailable).toBe(true))
  })

  it('reports piiUnavailable when the profile RPC fails outright', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHookWithClient(() => useMyProfile('p1'))

    await waitFor(() => expect(result.current.piiUnavailable).toBe(true))
    expect(result.current.hasPii).toBe(false)
  })

  it('is true once the profile RPC resolves an actual row', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'p1', name: 'Ada', email: 'ada@example.com', phone: '', birthday: null }],
      error: null,
    })

    const { result } = renderHookWithClient(() => useMyProfile('p1'))

    await waitFor(() => expect(result.current.hasPii).toBe(true))
    expect(result.current.piiUnavailable).toBe(false)
  })
})

// Finding 6: closing one surface that reveals a player's PII must not blank
// out a sibling surface still showing the same player (which would then
// immediately re-trigger another audited admin_get_player_pii read).
describe('useRevealPii unmount purge (finding 6)', () => {
  function Viewer({ testId }: { testId: string }) {
    const pii = useRevealPii('p1')
    useEffect(() => {
      pii.reveal()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return <span data-testid={testId}>{pii.pii?.email ?? (pii.isLoading ? '…' : '')}</span>
  }

  function Harness() {
    const [showFirst, setShowFirst] = useState(true)
    return (
      <div>
        <button onClick={() => setShowFirst(false)}>close first</button>
        {showFirst && <Viewer testId="first" />}
        <Viewer testId="second" />
      </div>
    )
  }

  it('a still-open sibling keeps its data after the other surface unmounts', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })
    const { getByText, getByTestId } = renderWithClient(<Harness />)

    await waitFor(() => expect(getByTestId('second').textContent).toBe('ada@example.com'))
    expect(mockRpc).toHaveBeenCalledTimes(1)

    fireEvent.click(getByText('close first'))

    // The surviving viewer keeps its data, and closing the other one does
    // not trigger another audited read.
    await waitFor(() => expect(getByTestId('second').textContent).toBe('ada@example.com'))
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  // Keeps the pre-existing "Hide" behaviour intact: an explicit hide() on
  // the sole surface showing a player's PII still purges it immediately
  // (least-retention), rather than only relying on gcTime. hide() forgets
  // unconditionally (no onlyIfUnobserved), unlike the unmount-cleanup path.
  it('an explicit hide on the sole consumer still purges the cached PII', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })
    const { result, client } = renderHookWithClient(() => useRevealPii('p1'))

    act(() => result.current.reveal())
    await waitFor(() => expect(result.current.pii?.email).toBe('ada@example.com'))

    act(() => result.current.hide())

    expect(client.getQueryData(playerPiiKeys.detail('p1'))).toBeUndefined()
  })
})
