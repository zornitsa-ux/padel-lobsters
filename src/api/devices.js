import { supabase } from '../supabase'
import { getDeviceId } from '../lib/deviceId'

// Player-side: list this player's own pending devices.
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
    return { ok: false, reason: 'error' }
  }
}

// Admin: list all pending devices across all players.
export async function adminListPendingDevices() {
  try {
    const { data, error } = await supabase.rpc('admin_list_pending_devices')
    if (error) {
      console.error('admin_list_pending_devices error:', error)
      return []
    }
    return Array.isArray(data) ? data : []
  } catch (e) {
    return []
  }
}

// Admin: recent security events feed (pin_attempts, joined to player names).
export async function adminListSecurityEvents(limit = 100) {
  try {
    const { data, error } = await supabase.rpc('admin_list_security_events', {
      input_limit: limit,
    })
    if (error) {
      console.error('admin_list_security_events error:', error)
      return []
    }
    return Array.isArray(data) ? data : []
  } catch (e) {
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
      return { ok: false }
    }
    return { ok: data === 'ok', reason: data }
  } catch (e) {
    return { ok: false }
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
      return { ok: false }
    }
    return { ok: data === 'ok', reason: data }
  } catch (e) {
    return { ok: false }
  }
}

// Admin: clear a player's lockout state. Optionally also auto-trust
// a target device (useful for "they lost their old phone" recovery).
export async function adminUnlockPlayer(targetPlayerId, targetDeviceId = null) {
  const adminDeviceId = getDeviceId()
  try {
    const { data, error } = await supabase.rpc('admin_unlock_player', {
      input_target_player: targetPlayerId,
      input_target_device: targetDeviceId,
      input_admin_device_id: adminDeviceId,
    })
    if (error) {
      console.error('admin_unlock_player error:', error)
      return { ok: false }
    }
    return { ok: data === 'ok', reason: data }
  } catch (e) {
    return { ok: false }
  }
}
