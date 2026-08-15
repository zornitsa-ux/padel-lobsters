import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../test/mockSupabase'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../supabase', () => mockSupabase({ rpc: mockRpc }))

vi.mock('../lib/toastBus', () => ({
  emitToast: vi.fn(),
}))

import { emitToast } from '../lib/toastBus'
import { adminListSecurityEvents } from './securityEvents'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('adminListSecurityEvents', () => {
  it('returns [] and toasts when the RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network down'))

    await expect(adminListSecurityEvents()).resolves.toEqual([])
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })

  it('returns [] and toasts when the RPC responds with an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await expect(adminListSecurityEvents()).resolves.toEqual([])
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })
})
