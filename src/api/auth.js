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

// ── Magic link sign-in ──────────────────────────────────────────
// shouldCreateUser:false enforces the 1:1 players↔auth.users invariant:
// Supabase will refuse to sign in an email that has no matching
// auth.users row. To become a player you still go through the
// admin-invite or self_signup_player path; magic link is purely a way
// for an existing player to authenticate.
//
// Returns one of:
//   'sent'     — link emailed, tell the user to check their inbox
//   'unknown'  — email is not on file (Supabase returns an error)
//   'invalid'  — input failed basic validation
//   'error'    — network / unexpected
export async function sendMagicLink(email) {
  const trimmed = String(email || '')
    .trim()
    .toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return 'invalid'
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: false,
        // Land on the SPA's /auth/confirm route — the template appends
        // &token_hash=...&type=magiclink, and the route calls verifyOtp.
        // See supabase/templates/magic_link.html for the matching URL shape.
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/home`,
      },
    })
    if (error) {
      // Supabase returns "Signups not allowed for otp" when shouldCreateUser=false
      // hits an unknown email. Anything else is a genuine failure.
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('signup') || msg.includes('not allowed') || msg.includes('not found')) {
        return 'unknown'
      }
      console.error('sendMagicLink error:', error)
      return 'error'
    }
    return 'sent'
  } catch (e) {
    console.error('sendMagicLink threw:', e)
    return 'error'
  }
}

// ── Post-sign-in device bootstrap ──────────────────────────────
// Called after a magic-link (or future OAuth) sign-in to register the
// current browser as a device for the player. Mirrors what verify-pin
// does for the PIN flow. After this resolves we force a token refresh
// so the custom_access_token_hook can bake the new device_id into the
// JWT — without that refresh, require_trusted_device() would still see
// the empty claim from the initial OTP-issued token.
export async function bootstrapDeviceSession() {
  const deviceId = getDeviceId()
  try {
    const { data, error } = await supabase.rpc('bootstrap_device_session', {
      p_device_id: deviceId,
    })
    if (error) {
      console.error('bootstrap_device_session error:', error)
      return null
    }
    await supabase.auth.refreshSession()
    return data
  } catch (e) {
    console.error('bootstrap_device_session threw:', e)
    return null
  }
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

// ── Self-service email change ───────────────────────────────────────
// Wraps supabase.auth.updateUser. Supabase sends a confirmation link to
// the new address (and, with double_confirm_changes enabled in
// config.toml, also to the old one). When the user clicks through,
// auth.users.email changes — the sync_auth_email_to_player trigger
// mirrors the new value back to players.email. We do not write
// players.email here; the confirmation flow is the source of truth.
//
// Returns:
//   'sent'    — confirmation email(s) dispatched
//   'invalid' — input failed basic validation
//   'taken'   — email already on another auth.users row
//   'error'   — anything else
export async function requestMyEmailChange(email) {
  const trimmed = String(email || '')
    .trim()
    .toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return 'invalid'
  try {
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('taken')) {
        return 'taken'
      }
      console.error('requestMyEmailChange error:', error)
      return 'error'
    }
    return 'sent'
  } catch (e) {
    console.error('requestMyEmailChange threw:', e)
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
