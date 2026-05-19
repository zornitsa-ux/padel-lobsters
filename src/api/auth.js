import { supabase } from '../supabase'
import { getDeviceId, getUserAgentSummary } from '../lib/deviceId'

// ── Auth ─────────────────────────────────────────────────
export async function loginWithPin(enteredPin) {
  const pin = String(enteredPin || '').trim()
  if (!pin) return { success: false, error: 'Enter your PIN' }
  const deviceId = getDeviceId()
  const userAgent = getUserAgentSummary()
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ pin, device_id: deviceId, user_agent: userAgent }),
    })
    const json = await res.json()
    if (!res.ok) return { success: false, error: json?.error || 'Login failed' }
    const { access_token, refresh_token, role } = json
    const {
      data: { session: newSession },
      error: sessErr,
    } = await supabase.auth.setSession({ access_token, refresh_token })
    if (sessErr) return { success: false, error: sessErr.message }
    return { success: true, role, session: newSession }
  } catch (e) {
    console.error('loginWithPin threw', e)
    return { success: false, error: 'Login failed' }
  }
}

export function logout() {
  return supabase.auth.signOut()
}

// Fetch the signed-in player's full record (including email / phone / full
// birthday) through the secure RPC. Returns null if no PIN is cached or the
// RPC call fails. Used by Settings' profile drawer.
//
// Phase 2b: uses get_my_profile_v2 which requires the calling device to
// be trusted. A probationary device gets an empty response — Settings
// should not call this until trust is confirmed.
export async function fetchMyProfile() {
  try {
    const { data, error } = await supabase.rpc('get_my_profile_v2')
    if (error) {
      console.error('get_my_profile_v2 error:', error)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    return row || null
  } catch (e) {
    console.error('get_my_profile_v2 threw:', e)
    return null
  }
}

// Admin-only: fetch all players with full PII via the admin-gated RPC.
//
// Phase 2b: uses get_all_players_with_pii_v2 which adds a 24h quota
// (default 3 successful dumps per day, audit-logged) and per-device
// rate limiting. Returns null on quota exhaustion or admin re-auth
// failure — caller should treat null as "try again later or contact
// another admin." Every successful call is visible in the admin
// security-events panel.
export async function fetchAllPlayersWithPii() {
  try {
    const { data, error } = await supabase.rpc('get_all_players_with_pii_v2')
    if (error) {
      console.error('get_all_players_with_pii_v2 error:', error)
      return null
    }
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error('get_all_players_with_pii_v2 threw:', e)
    return null
  }
}

// ── Forgot PIN: email-based self-service reset ──────────────────────
// Wraps the forgot_my_pin RPC. Player provides their email, we look up
// their row, generate a fresh PIN, hash it, and email the new PIN via
// the send-pin-email Edge Function. The plaintext never crosses the
// browser — it's generated and emailed entirely server-side.
//
// Returns one of:
//   'sent'          — new PIN emailed, tell the user to check their inbox
//   'contact_admin' — no active player matches that email; route to WhatsApp
//   'rate_limited'  — too many resets in the last 24h
//   'invalid'       — input failed validation (bad email format etc.)
//   'error'         — RPC threw / network error
export async function forgotMyPin(email) {
  const deviceId = getDeviceId()
  const userAgent = getUserAgentSummary()
  try {
    const { data, error } = await supabase.rpc('forgot_my_pin', {
      input_email: String(email || '').trim(),
      input_device_id: deviceId,
      input_user_agent: userAgent,
    })
    if (error) {
      console.error('forgot_my_pin error:', error)
      return 'error'
    }
    return data || 'error'
  } catch (e) {
    console.error('forgot_my_pin threw:', e)
    return 'error'
  }
}

// ── Self-serve signup (Phase 3: "create a Lobster from the PIN prompt") ──
// Wraps the v25 self_signup_player RPC. Returns { data, error } so the
// signup form can render inline feedback. data is { player_id, pin,
// was_existing } on success; error is a plain object with a .message.
//
// Intentionally no auto-login here — the caller handles that so the UI
// can show the PIN to the user first. Keeps this function focused on
// one job.
export async function selfSignup(data) {
  const name = (data?.name || '').trim()
  const email = (data?.email || '').trim()
  if (!name || !email) {
    return { data: null, error: { message: 'Name and email are required' } }
  }
  // RPC takes a jsonb payload with the same shape as admin_add_player
  // so SignupRequest.jsx can capture the rich profile (country, level,
  // avatar, etc) on first signup.
  const payload = {
    name,
    email,
    phone: (data.phone || '').trim(),
    notes: data.notes || '',
    playtomic_level: String(parseFloat(data.playtomicLevel) || 0),
    adjustment: String(parseFloat(data.adjustment) || 0),
    playtomic_username: data.playtomicUsername || '',
    gender: data.gender || '',
    is_left_handed: String(!!data.isLeftHanded),
    country: data.country || '',
    avatar_url: data.avatarUrl || '',
    birthday: data.birthday || '',
    preferred_position: data.preferredPosition || '',
    tagline_label: data.taglineLabel || '',
  }
  const deviceId = getDeviceId()
  const userAgent = getUserAgentSummary()
  try {
    const { data: rows, error } = await supabase.rpc('self_signup_player', {
      input_payload: payload,
      input_device_id: deviceId,
      input_user_agent: userAgent,
    })
    if (error) {
      console.error('self_signup_player error:', error)
      return { data: null, error }
    }
    // RPC returns setof → supabase-js wraps it in an array.
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row) return { data: null, error: { message: 'Signup RPC returned no row' } }
    // was_existing=true means the email is already on an active row;
    // the RPC deliberately returns NO pin in that case so the UI can
    // route the user to Forgot-my-PIN instead of disclosing a PIN to
    // a stranger holding only the email.
    return {
      data: {
        player_id: row.player_id,
        pin: row.pin,
        was_existing: Boolean(row.was_existing),
      },
      error: null,
    }
  } catch (e) {
    console.error('self_signup_player threw:', e)
    return { data: null, error: e }
  }
}
