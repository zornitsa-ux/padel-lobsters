import { describe, expect, it, vi } from 'vitest'
import useDevices from './useDevices'
import * as devicesApi from '../api/devices'

vi.mock('../api/devices', () => ({
  listMyPendingDevices: vi.fn(),
  approveMyDevice: vi.fn(),
  rejectMyDevice: vi.fn(),
  adminListPendingDevices: vi.fn(),
  adminListSecurityEvents: vi.fn(),
  adminApproveDevice: vi.fn(),
  adminDenyDevice: vi.fn(),
}))

describe('useDevices', () => {
  it('returns API methods as a stable mapping object', () => {
    const api = useDevices()

    expect(api.listMyPendingDevices).toBe(devicesApi.listMyPendingDevices)
    expect(api.approveMyDevice).toBe(devicesApi.approveMyDevice)
    expect(api.rejectMyDevice).toBe(devicesApi.rejectMyDevice)
    expect(api.adminListPendingDevices).toBe(devicesApi.adminListPendingDevices)
    expect(api.adminListSecurityEvents).toBe(devicesApi.adminListSecurityEvents)
    expect(api.adminApproveDevice).toBe(devicesApi.adminApproveDevice)
    expect(api.adminDenyDevice).toBe(devicesApi.adminDenyDevice)
  })
})
