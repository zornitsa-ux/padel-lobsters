import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../test/mockSupabase'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('../supabase', () => mockSupabase({ from: mockFrom }))

vi.mock('../lib/toastBus', () => ({
  emitToast: vi.fn(),
}))

import { emitToast } from '../lib/toastBus'
import { loadPlayerAliases } from './aliases'

function mockSelect(result: { data: unknown; error: unknown }) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockResolvedValue(result),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('loadPlayerAliases', () => {
  it('builds a historical_name -> player_id map, using the sentinel for skipped rows', async () => {
    mockSelect({
      data: [
        { historical_name: 'Old Name', player_id: 'p1', skipped: false },
        { historical_name: 'Ghost', player_id: null, skipped: true },
      ],
      error: null,
    })

    await expect(loadPlayerAliases()).resolves.toEqual({
      'Old Name': 'p1',
      Ghost: '__not_in_roster__',
    })
    expect(emitToast).not.toHaveBeenCalled()
  })

  it('degrades to {} quietly when the table is missing (pre-migration state)', async () => {
    mockSelect({ data: null, error: { code: '42P01', message: 'relation does not exist' } })

    await expect(loadPlayerAliases()).resolves.toEqual({})
    expect(console.error).toHaveBeenCalled()
    expect(emitToast).not.toHaveBeenCalled()
  })

  it('returns {} but toasts on a genuine failure', async () => {
    mockSelect({ data: null, error: { code: '500', message: 'internal error' } })

    await expect(loadPlayerAliases()).resolves.toEqual({})
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })
})
