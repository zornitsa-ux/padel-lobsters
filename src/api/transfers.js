import { supabase } from '../supabase'

// Loads every transfer row. The table is tiny (a handful per week) and
// anon SELECT is permitted, so no filter — admins need to see all
// pending transfers, players need to see their own pending+history. The
// UI does the per-user / per-tournament filtering downstream.
export async function loadTransfers() {
  try {
    const { data, error } = await supabase
      .from('registration_transfers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (e) {
    // Migration may not be applied yet on this environment — degrade
    // gracefully so the rest of the app still works.
    console.warn('loadTransfers skipped:', e?.message)
    return []
  }
}

// ── Registration transfers (acceptance flow) ────────────────────────
// Four wrappers around the SECURITY DEFINER RPCs added in migration
// add_registration_transfers. Each one returns { ok, status, transferId? }
// so callers can branch on the RPC's status text without parsing errors.
export async function createTransfer(toPlayerId, tournamentId) {
  try {
    const { data, error } = await supabase.rpc('create_transfer', {
      input_to_player_id: toPlayerId,
      input_tournament_id: tournamentId,
    })
    if (error) {
      console.error('create_transfer error:', error)
      return { ok: false, status: 'error' }
    }
    const row = Array.isArray(data) ? data[0] : data
    const status = row?.status
    const transferId = row?.transfer_id
    if (status === 'ok' || status === 'already_pending') {
      return { ok: true, status, transferId }
    }
    return { ok: false, status: status || 'error', transferId }
  } catch (e) {
    console.error('create_transfer threw:', e)
    return { ok: false, status: 'error' }
  }
}

export async function respondToTransfer(transferId, accept) {
  try {
    const { data, error } = await supabase.rpc('respond_to_transfer', {
      input_transfer_id: transferId,
      input_accept: !!accept,
    })
    if (error) {
      console.error('respond_to_transfer error:', error)
      return { ok: false, status: 'error' }
    }
    const row = Array.isArray(data) ? data[0] : data
    const status = row?.status
    if (status === 'accepted' || status === 'declined') {
      return { ok: true, status }
    }
    return { ok: false, status: status || 'error' }
  } catch (e) {
    console.error('respond_to_transfer threw:', e)
    return { ok: false, status: 'error' }
  }
}

export async function cancelTransfer(transferId) {
  try {
    const { data, error } = await supabase.rpc('cancel_transfer', {
      input_transfer_id: transferId,
    })
    if (error) {
      console.error('cancel_transfer error:', error)
      return { ok: false, status: 'error' }
    }
    const row = Array.isArray(data) ? data[0] : data
    const status = row?.status
    if (status === 'cancelled') {
      return { ok: true, status }
    }
    return { ok: false, status: status || 'error' }
  } catch (e) {
    console.error('cancel_transfer threw:', e)
    return { ok: false, status: 'error' }
  }
}

// Admin-only cancel: cancels any pending offer regardless of which
// player initiated it. Different from cancelTransfer (which checks
// the from-player's PIN). Status text on the row gets a distinct
// closed_reason='admin_cancel' for auditability.
export async function adminCancelTransfer(transferId) {
  try {
    const { data, error } = await supabase.rpc('admin_cancel_transfer', {
      input_transfer_id: transferId,
    })
    if (error) {
      console.error('admin_cancel_transfer error:', error)
      return { ok: false, status: 'error' }
    }
    const row = Array.isArray(data) ? data[0] : data
    const status = row?.status
    if (status === 'cancelled') {
      return { ok: true, status }
    }
    return { ok: false, status: status || 'error' }
  } catch (e) {
    console.error('admin_cancel_transfer threw:', e)
    return { ok: false, status: 'error' }
  }
}

export async function forceAcceptTransfer(transferId) {
  try {
    const { data, error } = await supabase.rpc('admin_force_accept_transfer', {
      input_transfer_id: transferId,
    })
    if (error) {
      console.error('admin_force_accept_transfer error:', error)
      return { ok: false, status: 'error' }
    }
    const row = Array.isArray(data) ? data[0] : data
    const status = row?.status
    if (status === 'accepted') {
      return { ok: true, status }
    }
    return { ok: false, status: status || 'error' }
  } catch (e) {
    console.error('admin_force_accept_transfer threw:', e)
    return { ok: false, status: 'error' }
  }
}

// Privacy-respecting fetch of the to-player's phone for a pending
// transfer the current user initiated. Returns { ok, name, phone }.
// Returns ok:false when the caller isn't the from-player or the
// transfer isn't pending — the API never leaks phone numbers to
// anyone other than the offer's initiator.
export async function getTransferRecipientContact(transferId) {
  try {
    const { data, error } = await supabase.rpc('get_transfer_recipient_phone', {
      input_transfer_id: transferId,
    })
    if (error) {
      console.error('get_transfer_recipient_phone error:', error)
      return { ok: false, status: 'error' }
    }
    const row = Array.isArray(data) ? data[0] : data
    if (row?.status === 'ok') {
      return { ok: true, status: 'ok', name: row.name || '', phone: row.phone || '' }
    }
    return { ok: false, status: row?.status || 'error' }
  } catch (e) {
    console.error('get_transfer_recipient_phone threw:', e)
    return { ok: false, status: 'error' }
  }
}
