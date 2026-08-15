// =====================================================================
// Device identity.
//
// Generates a random UUID once per browser/profile, persists it in
// localStorage, and reuses it forever (until the user clears storage or
// switches browsers). Sent on every PIN auth call so the backend can key
// its per-device rate limits: verify_player_pin_v2's 10-failed-PINs/24h
// cap and self_signup_player's 5-signups/24h cap, and so the admin audit
// trail can tell attempts from the same browser apart.
//
// The device_id is opaque to the backend — it has no PII, no fingerprint,
// no identifying info.
// =====================================================================

const DEVICE_ID_KEY = 'lobster_device_id'

// Lightweight UUID v4. crypto.randomUUID() is available in all modern
// browsers (Safari 15.4+, Chrome 92+, Firefox 95+) — well within our
// support window. Fallback to a manual hex generator on the off chance
// the API isn't available.
function newDeviceId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  // Manual v4-shaped hex (good enough as a unique ID, not cryptographic)
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  let s = ''
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) s += '-'
    s += hex()
  }
  return s
}

/**
 * Returns the persistent device_id for this browser. Creates one on
 * first call, then returns the same value on every subsequent call.
 * Synchronous — safe to use during render.
 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = newDeviceId()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage unavailable (private browsing edge cases). Generate
    // a per-session id so auth still works — note this also resets the
    // backend's per-device rate limits on every load.
    return newDeviceId()
  }
}

/**
 * Returns a short-ish UA string for logging. We don't need full
 * fingerprinting — just enough to recognize "the iPhone" vs "the
 * laptop" in the security-events feed.
 */
export function getUserAgentSummary() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  // Truncate to keep audit log rows tidy. The full UA is rarely useful
  // and clutters the admin event feed.
  return ua.length > 200 ? ua.slice(0, 200) + '…' : ua
}
