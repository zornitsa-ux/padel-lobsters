import * as devicesApi from '../api/devices'
import type { Database } from '../lib/database.types'

// Row shapes returned by the device RPCs. `api/devices.js` is untyped, so
// consumers annotate the values they receive with these; the shapes come from
// the generated DB types so they can't drift from the functions themselves.
type Fn = Database['public']['Functions']

export type MyPendingDeviceRow = Fn['list_pending_devices']['Returns'][number]
export type PendingDeviceRow = Fn['admin_list_pending_devices']['Returns'][number]
export type SecurityEventRow = Fn['admin_list_security_events']['Returns'][number]

// Both the player-side and admin-side action helpers resolve to this.
export interface DeviceActionResult {
  ok: boolean
  reason?: string
}

export default function useDevices() {
  return {
    isMyDeviceTrusted: devicesApi.isMyDeviceTrusted,
    listMyPendingDevices: devicesApi.listMyPendingDevices,
    approveMyDevice: devicesApi.approveMyDevice,
    rejectMyDevice: devicesApi.rejectMyDevice,
    adminListPendingDevices: devicesApi.adminListPendingDevices,
    adminListSecurityEvents: devicesApi.adminListSecurityEvents,
    adminApproveDevice: devicesApi.adminApproveDevice,
    adminDenyDevice: devicesApi.adminDenyDevice,
  }
}
