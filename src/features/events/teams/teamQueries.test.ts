import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../../test/mockSupabase'

const m = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), select: vi.fn() }))

vi.mock('../../../supabase', () => mockSupabase({ from: vi.fn(() => ({ update: m.update })) }))

import { updateEventTeams } from './teamQueries'

beforeEach(() => {
  vi.clearAllMocks()
  m.update.mockReturnValue({ eq: m.eq })
  m.eq.mockReturnValue({ select: m.select })
  m.select.mockResolvedValue({ data: [{ id: 'x' }], error: null })
})

describe('updateEventTeams', () => {
  it('writes only the columns each patch names', async () => {
    await updateEventTeams({
      patches: [
        { id: 't1', seed: 2 },
        { id: 't2', finalRank: null },
      ],
    })

    expect(m.update).toHaveBeenCalledWith({ seed: 2, final_rank: undefined })
    expect(m.update).toHaveBeenCalledWith({ seed: undefined, final_rank: null })
    expect(m.eq).toHaveBeenCalledWith('id', 't1')
    expect(m.eq).toHaveBeenCalledWith('id', 't2')
  })

  it('treats an update that touched no row as a failure (RLS no-op)', async () => {
    m.select.mockResolvedValue({ data: [], error: null })
    await expect(updateEventTeams({ patches: [{ id: 't1', seed: 1 }] })).rejects.toThrow(
      'Team t1 was not updated',
    )
  })

  it('throws the database error', async () => {
    const err = { message: 'denied' }
    m.select.mockResolvedValue({ data: null, error: err })
    await expect(updateEventTeams({ patches: [{ id: 't1', seed: 1 }] })).rejects.toBe(err)
  })
})
