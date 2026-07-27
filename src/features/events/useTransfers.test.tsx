// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor, act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { transferKeys } from './transferKeys'
import { registrationKeys } from './registrationKeys'
import { useTransfers, useTransferActions } from './useTransfers'

vi.mock('./transferQueries', () => ({
  fetchTransfers: vi.fn(),
  createTransfer: vi.fn(),
  respondToTransfer: vi.fn(),
  cancelTransfer: vi.fn(),
  adminCancelTransfer: vi.fn(),
  forceAcceptTransfer: vi.fn(),
  getTransferRecipientContact: vi.fn(),
}))

import * as q from './transferQueries'

const mockTransfers = [
  {
    id: 'xfer-1',
    tournamentId: 'tid-1',
    fromPlayerId: 'pid-1',
    toPlayerId: 'pid-2',
    status: 'pending',
  },
]

const authedSession = { user: { id: 'pid-1' } }

beforeEach(() => {
  vi.clearAllMocks()
  ;(q.fetchTransfers as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransfers)
})

// ── useTransfers ─────────────────────────────────────────────────────────────

describe('useTransfers', () => {
  it('resolves to the data fetchTransfers returns', async () => {
    const { result } = renderHookWithClient(() => useTransfers())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockTransfers)
  })
})

// ── useTransferActions ────────────────────────────────────────────────────────

describe('useTransferActions', () => {
  it('createTransfer returns not_authenticated without calling query fn when session is null', async () => {
    const { result } = renderHookWithClient(() => useTransferActions({ session: null }))

    let res: unknown
    await act(async () => {
      res = await result.current.createTransfer('pid-2', 'tid-1')
    })

    expect(res).toEqual({ ok: false, status: 'not_authenticated' })
    expect(q.createTransfer).not.toHaveBeenCalled()
  })

  it('respondToTransfer calls query fn and invalidates both keys on ok:true', async () => {
    ;(q.respondToTransfer as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 'accepted',
    })

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => useTransferActions({ session: authedSession }),
      client,
    )

    await act(async () => {
      await result.current.respondToTransfer('xfer-1', true)
    })

    expect(q.respondToTransfer).toHaveBeenCalledWith('xfer-1', true)
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: transferKeys.all() })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: registrationKeys.all() })
  })

  it('respondToTransfer does not invalidate when result is not ok', async () => {
    ;(q.respondToTransfer as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 'not_pending',
    })

    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHookWithClient(
      () => useTransferActions({ session: authedSession }),
      client,
    )

    await act(async () => {
      await result.current.respondToTransfer('xfer-1', true)
    })

    expect(client.invalidateQueries).not.toHaveBeenCalled()
  })
})
