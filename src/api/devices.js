import { supabase } from '../supabase'
import { getDeviceId } from '../lib/deviceId'
import { emitToast } from '../lib/toastBus'

// Player-side: list this player's own pending devices. Runs unattended on
// every Settings mount, so a transient failure stays quiet rather than
// toasting the player for something they didn't trigger — the widget just
// renders as if there's nothing to approve, same as it would while loading.
export async function listMyPendingDevices() {
  const deviceId = getDeviceId()
  try {
    const { data, error } = await supabase.rpc('list_pending_devices', {
      input_requesting_device_id: deviceId,
    })
    if (error) {
      console.error('list_pending_devices error:', error)
      return []
    }
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('list_pending_devices error:', error)
    return []
  }
}

// Player-side: approve one of my own pending devices.
// Returns { ok, reason } where reason ∈ 'ok' | 'denied' | 'no_such_device' | 'error'.
export async function approveMyDevice(targetDeviceId) {
  const deviceId = getDeviceId()
  try {
    const { data, error } = await supabase.rpc('approve_device', {
      input_requesting_device_id: deviceId,
      input_target_device_id: targetDeviceId,
    })
    if (error) {
      console.error('approve_device error:', error)
      return { ok: false, reason: 'error' }
    }
    return { ok: data === 'ok', reason: data }
  } catch (error) {
    console.error('approve_device error:', error)
    return { ok: false, reason: 'error' }
  }
}

// Player-side: reject one of my own pending devices. Mirrors approve
// but deletes the pending row instead of marking it trusted. Same
// auth gates as approve (caller must be trusted for this player).
export async function rejectMyDevice(targetDeviceId) {
  const deviceId = getDeviceId()
  try {
    const { data, error } = await supabase.rpc('reject_device', {
      input_requesting_device_id: deviceId,
      input_target_device_id: targetDeviceId,
    })
    if (error) {
      console.error('reject_device error:', error)
      return { ok: false, reason: 'error' }
    }
    return { ok: data === 'ok', reason: data }
  } catch (error) {
    console.error('reject_device error:', error)
    return { ok: false, reason: 'error' }
  }
}

// Admin: list all pending devices across all players. Read feeds the
// security panel an admin explicitly opened — a failure here can look
// identical to "nothing pending" (a false negative in a security review),
// so it's toasted rather than left quiet.
export async function adminListPendingDevices() {
  try {
    const { data, error } = await supabase.rpc('admin_list_pending_devices')
    if (error) {
      console.error('admin_list_pending_devices error:', error)
      emitToast({ variant: 'error', message: 'Could not load pending device approvals.' })
      return []
    }
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('admin_list_pending_devices error:', error)
    emitToast({ variant: 'error', message: 'Could not load pending device approvals.' })
    return []
  }
}

// Admin: recent security events feed (pin_attempts, joined to player names).
// Same reasoning as adminListPendingDevices — an admin reviewing security
// events needs to know the feed didn't load, not see an empty log.
export async function adminListSecurityEvents(limit = 100) {
  try {
    const { data, error } = await supabase.rpc('admin_list_security_events', {
      input_limit: limit,
    })
    if (error) {
      console.error('admin_list_security_events error:', error)
      emitToast({ variant: 'error', message: 'Could not load recent security events.' })
      return []
    }
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('admin_list_security_events error:', error)
    emitToast({ variant: 'error', message: 'Could not load recent security events.' })
    return []
  }
}

// Admin: approve a pending device by sidestepping the trusted-device requirement.
export async function adminApproveDevice(targetPlayerId, targetDeviceId) {
  try {
    const { data, error } = await supabase.rpc('admin_approve_device', {
      input_target_player: targetPlayerId,
      input_target_device: targetDeviceId,
    })
    if (error) {
      console.error('admin_approve_device error:', error)
      return { ok: false, reason: 'error' }
    }
    return { ok: data === 'ok', reason: data }
  } catch (error) {
    console.error('admin_approve_device error:', error)
    return { ok: false, reason: 'error' }
  }
}

// Admin: drop a pending device row entirely (user can re-trigger by
// logging in again with the right PIN).
export async function adminDenyDevice(targetPlayerId, targetDeviceId) {
  try {
    const { data, error } = await supabase.rpc('admin_deny_device', {
      input_target_player: targetPlayerId,
      input_target_device: targetDeviceId,
    })
    if (error) {
      console.error('admin_deny_device error:', error)
      return { ok: false, reason: 'error' }
    }
    return { ok: data === 'ok', reason: data }
  } catch (error) {
    console.error('admin_deny_device error:', error)
    return { ok: false, reason: 'error' }
  }
}
