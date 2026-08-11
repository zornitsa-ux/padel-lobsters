import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

// Chain helpers hoisted so the vi.mock factory can reference them.
const { mockRpc, mockOrder, mockSelect } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockOrder: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('../../supabase', () =>
  mockSupabase({
    from: vi.fn(() => ({
      select: mockSelect,
    })),
    rpc: mockRpc,
  }),
)

import { fetchTransfers, createTransfer, forceAcceptTransfer } from './transferQueries'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockSelect.mockReturnValue({ order: mockOrder })
  mockOrder.mockResolvedValue({ data: [], error: null })
  mockRpc.mockResolvedValue({ data: null, error: null })
})

// ── fetchTransfers ────────────────────────────────────────────────────────────

describe('fetchTransfers', () => {
  it('returns normalised transfers with camelCase fields', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'xfer-1',
          tournament_id: 'tid-1',
          from_player_id: 'pid-1',
          to_player_id: 'pid-2',
          status: 'pending',
          closed_reason: null,
          responded_at: null,
          closed_at: null,
          created_at: '2026-06-01T10:00:00Z',
        },
      ],
      error: null,
    })

    const result = await fetchTransfers()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'xfer-1',
      tournamentId: 'tid-1',
      fromPlayerId: 'pid-1',
      toPlayerId: 'pid-2',
      status: 'pending',
    })
  })

  it('orders by created_at descending', async () => {
    await fetchTransfers()
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns [] when supabase throws (degrade path)', async () => {
    mockOrder.mockRejectedValue(new Error('relation does not exist'))
    const result = await fetchTransfers()
    expect(result).toEqual([])
    expect(console.warn).toHaveBeenCalled()
  })

  it('returns [] when supabase returns an error (degrade path)', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    const result = await fetchTransfers()
    expect(result).toEqual([])
    expect(console.warn).toHaveBeenCalled()
  })
})

// ── createTransfer ────────────────────────────────────────────────────────────

describe('createTransfer', () => {
  it('returns { ok: true, status: "ok" } shape on an ok rpc row', async () => {
    mockRpc.mockResolvedValue({
      data: [{ status: 'ok', transfer_id: 'tid-abc' }],
      error: null,
    })

    const result = await createTransfer('pid-2', 'tid-1')

    expect(result).toEqual({ ok: true, status: 'ok', transferId: 'tid-abc' })
    expect(mockRpc).toHaveBeenCalledWith('create_transfer', {
      input_to_player_id: 'pid-2',
      input_tournament_id: 'tid-1',
    })
  })

  it('returns { ok: true, status: "already_pending" } for already_pending status', async () => {
    mockRpc.mockResolvedValue({
      data: { status: 'already_pending', transfer_id: 'tid-xyz' },
      error: null,
    })

    const result = await createTransfer('pid-2', 'tid-1')

    expect(result).toEqual({ ok: true, status: 'already_pending', transferId: 'tid-xyz' })
  })

  it('returns { ok: false, status: "error" } on rpc error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } })

    const result = await createTransfer('pid-2', 'tid-1')

    expect(result).toEqual({ ok: false, status: 'error' })
    expect(console.error).toHaveBeenCalled()
  })

  it('returns { ok: false, status: "error" } when rpc throws', async () => {
    mockRpc.mockRejectedValue(new Error('network error'))

    const result = await createTransfer('pid-2', 'tid-1')

    expect(result).toEqual({ ok: false, status: 'error' })
    expect(console.error).toHaveBeenCalled()
  })
})

// ── forceAcceptTransfer ───────────────────────────────────────────────────────

describe('forceAcceptTransfer', () => {
  it('returns { ok: true, status: "accepted" } when rpc status is accepted', async () => {
    mockRpc.mockResolvedValue({ data: [{ status: 'accepted' }], error: null })

    const result = await forceAcceptTransfer('xfer-1')

    expect(result).toEqual({ ok: true, status: 'accepted' })
    expect(mockRpc).toHaveBeenCalledWith('admin_force_accept_transfer', {
      input_transfer_id: 'xfer-1',
    })
  })

  it('returns { ok: false, status: "not_pending" } for non-accepted status', async () => {
    mockRpc.mockResolvedValue({ data: [{ status: 'not_pending' }], error: null })

    const result = await forceAcceptTransfer('xfer-1')

    expect(result).toEqual({ ok: false, status: 'not_pending' })
  })

  it('returns { ok: false, status: "error" } on rpc error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } })

    const result = await forceAcceptTransfer('xfer-1')

    expect(result).toEqual({ ok: false, status: 'error' })
    expect(console.error).toHaveBeenCalled()
  })
})
