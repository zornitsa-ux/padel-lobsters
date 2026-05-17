import * as devicesApi from '../api/devices'

export default function useDevices() {
  return {
    listMyPendingDevices: devicesApi.listMyPendingDevices,
    approveMyDevice: devicesApi.approveMyDevice,
    rejectMyDevice: devicesApi.rejectMyDevice,
    adminListPendingDevices: devicesApi.adminListPendingDevices,
    adminListSecurityEvents: devicesApi.adminListSecurityEvents,
    adminApproveDevice: devicesApi.adminApproveDevice,
    adminDenyDevice: devicesApi.adminDenyDevice,
  }
}
