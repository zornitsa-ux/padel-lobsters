import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc, mockFrom, mockOrder, mockFetchMyProfileRpc } = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockFrom = vi.fn((_table?: string) => ({
    select: (_cols?: string) => ({ order: mockOrder }),
  }))
  return { mockRpc: vi.fn(), mockFrom, mockOrder, mockFetchMyProfileRpc: vi.fn() }
})

vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc, from: mockFrom }))
vi.mock('../../api/auth', () => ({ fetchMyProfile: mockFetchMyProfileRpc }))

import { addPlayer, fetchPlayers, updatePlayer } from './playerQueries'

// The column list is built as one string literal, so capturing it means
// spying on .select(); this asserts the legacy columns are not requested.
let selectedColumns = ''
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  selectedColumns = ''
  mockFrom.mockImplementation(() => ({
    select: (cols?: string) => {
      selectedColumns = cols ?? ''
      return { order: mockOrder }
    },
  }))
  mockOrder.mockResolvedValue({ data: [], error: null })
  mockRpc.mockResolvedValue({ data: [{ id: 'p1' }], error: null })
})

const profile = {
  name: 'Ada',
  playtomicLevel: '3.5',
  gender: 'female',
  isLeftHanded: true,
  // A stale caller (or a spread of an old normalised player) may still carry
  // these; they must never reach an RPC payload.
  adjustment: '0.5',
  adjustedLevel: 4,
}

describe('fetchPlayers — roster columns', () => {
  it('no longer reads the deprecated adjustment / Glicko columns', async () => {
    await fetchPlayers()

    expect(selectedColumns).toContain('playtomic_level')
    for (const column of [
      'adjustment',
      'adjusted_level',
      'learned_rating',
      'learned_rd',
      'learned_matches_count',
    ]) {
      expect(selectedColumns).not.toContain(column)
    }
  })
})

describe('player write payloads', () => {
  const payloadOf = (call: number) => mockRpc.mock.calls[call][1].input_payload

  it('admin_add_player receives playtomic_level and no adjustment', async () => {
    await addPlayer(profile)

    expect(mockRpc).toHaveBeenCalledWith('admin_add_player', expect.anything())
    const payload = payloadOf(0)
    expect(payload.playtomic_level).toBe('3.5')
    expect(payload).not.toHaveProperty('adjustment')
    expect(payload).not.toHaveProperty('adjusted_level')
  })

  it('admin_update_player receives no adjustment even when the caller passes one', async () => {
    await updatePlayer('p1', profile, 'admin')

    expect(mockRpc.mock.calls[0][0]).toBe('admin_update_player')
    const payload = payloadOf(0)
    expect(payload.playtomic_level).toBe('3.5')
    expect(payload).not.toHaveProperty('adjustment')
  })

  it('sends the level as typed, and a missing one as empty, never "null"', async () => {
    await updatePlayer('p1', { playtomicLevel: '2,455' }, 'player')
    await updatePlayer('p1', { playtomicLevel: null }, 'player')
    await addPlayer({ name: 'Ada' })

    expect(payloadOf(0).playtomic_level).toBe('2,455')
    expect(payloadOf(1).playtomic_level).toBe('')
    expect(payloadOf(2).playtomic_level).toBe('')
  })

  it('update_my_profile receives no adjustment either', async () => {
    await updatePlayer('p1', profile, 'player')

    expect(mockRpc.mock.calls[0][0]).toBe('update_my_profile')
    expect(payloadOf(0)).not.toHaveProperty('adjustment')
  })
})

describe('player write level refusals (C-8)', () => {
  const refuse = (message: string) =>
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message } })

  it('shows level_required in words on a profile save', async () => {
    refuse('level_required')
    await expect(updatePlayer('p1', profile, 'player')).rejects.toThrow(
      /can be changed, but not removed/,
    )
  })

  it('shows invalid_level in words on an admin edit and an admin add', async () => {
    refuse('invalid_level')
    await expect(updatePlayer('p1', profile, 'admin')).rejects.toThrow(/at most 2 decimals/)
    await expect(addPlayer(profile)).rejects.toThrow(/at most 2 decimals/)
  })
})
