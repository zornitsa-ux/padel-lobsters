// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'
import { playerKeys } from './playerKeys'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc }))

import { fetchPlayersPii } from './playerQueries'
import { usePlayersPii } from './usePlayers'

const row = {
  id: 'p1',
  name: 'Ada',
  email: 'ada@example.com',
  phone: '+3161234567',
  birthday: '1990-12-10',
  notes: 'plays left',
  pin: '1234',
  pin_changes: 2,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchPlayersPii', () => {
  it('keys the admin PII rows by player id', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })

    await expect(fetchPlayersPii()).resolves.toEqual({
      p1: {
        email: 'ada@example.com',
        phone: '+3161234567',
        birthday: '1990-12-10',
        notes: 'plays left',
        pin: '1234',
        pinChanges: 2,
      },
    })
    expect(mockRpc).toHaveBeenCalledWith('get_all_players_with_pii_v2')
  })

  it('normalises missing columns to empty strings, not undefined', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'p2' }], error: null })

    await expect(fetchPlayersPii()).resolves.toEqual({
      p2: { email: '', phone: '', birthday: '', notes: '', pin: '', pinChanges: 0 },
    })
  })

  it('propagates the RPC error instead of returning an empty overlay', async () => {
    const err = { message: 'permission denied for function' }
    mockRpc.mockResolvedValue({ data: null, error: err })

    await expect(fetchPlayersPii()).rejects.toBe(err)
  })
})

describe('usePlayersPii', () => {
  it('caches the overlay under playerKeys.pii()', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })

    const { result, client } = renderHookWithClient(() => usePlayersPii({ role: 'admin' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData(playerKeys.pii())).toEqual(result.current.data)
  })

  it('never calls the audited RPC for a non-admin', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null })

    const { result } = renderHookWithClient(() => usePlayersPii({ role: 'player' }))

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(mockRpc).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('surfaces a failed dump as an error rather than as "no contact details"', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHookWithClient(() => usePlayersPii({ role: 'admin' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
