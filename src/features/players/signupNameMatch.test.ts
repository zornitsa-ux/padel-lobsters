import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc }))

import { fetchSignupNameMatch } from './signupNameMatch'

beforeEach(() => vi.clearAllMocks())

describe('fetchSignupNameMatch', () => {
  it.each(['placeholder', 'member'] as const)(
    'returns a %s match with the typed name',
    async (kind) => {
      mockRpc.mockResolvedValue({ data: kind, error: null })
      expect(await fetchSignupNameMatch({ name: 'Ada Lovelace' })).toEqual({
        kind,
        name: 'Ada Lovelace',
      })
      expect(mockRpc).toHaveBeenCalledWith('signup_name_match', { input_name: 'Ada Lovelace' })
    },
  )

  it('returns null when the name is free', async () => {
    mockRpc.mockResolvedValue({ data: 'none', error: null })
    expect(await fetchSignupNameMatch({ name: 'Ada Lovelace' })).toBeNull()
  })

  it('throws on an error', async () => {
    const err = new Error('boom')
    mockRpc.mockResolvedValue({ data: null, error: err })
    await expect(fetchSignupNameMatch({ name: 'Ada Lovelace' })).rejects.toBe(err)
  })
})
