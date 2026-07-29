import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../supabase', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('../lib/deviceId', () => ({
  getDeviceId: vi.fn(() => 'test-device-id'),
}))

vi.mock('../lib/toastBus', () => ({
  emitToast: vi.fn(),
}))

import { emitToast } from '../lib/toastBus'
import {
  listMyPendingDevices,
  adminListPendingDevices,
  adminListSecurityEvents,
  adminApproveDevice,
} from './devices'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('listMyPendingDevices', () => {
  it('returns [] and stays quiet (no toast) when the RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network down'))

    await expect(listMyPendingDevices()).resolves.toEqual([])
    expect(console.error).toHaveBeenCalled()
    expect(emitToast).not.toHaveBeenCalled()
  })

  it('returns [] and stays quiet when the RPC responds with an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await expect(listMyPendingDevices()).resolves.toEqual([])
    expect(emitToast).not.toHaveBeenCalled()
  })
})

describe('adminListPendingDevices', () => {
  it('returns [] and toasts when the RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network down'))

    await expect(adminListPendingDevices()).resolves.toEqual([])
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })

  it('returns [] and toasts when the RPC responds with an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await expect(adminListPendingDevices()).resolves.toEqual([])
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })
})

describe('adminListSecurityEvents', () => {
  it('returns [] and toasts when the RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network down'))

    await expect(adminListSecurityEvents()).resolves.toEqual([])
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })
})

describe('adminApproveDevice', () => {
  it('returns a distinguishable { ok: false, reason: "error" } when the RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network down'))

    await expect(adminApproveDevice('p1', 'd1')).resolves.toEqual({
      ok: false,
      reason: 'error',
    })
    // Write path already surfaces inline via the caller's own error state,
    // so no toast here.
    expect(emitToast).not.toHaveBeenCalled()
  })

  it('returns { ok: true } on success', async () => {
    mockRpc.mockResolvedValue({ data: 'ok', error: null })

    await expect(adminApproveDevice('p1', 'd1')).resolves.toEqual({ ok: true, reason: 'ok' })
  })
})
