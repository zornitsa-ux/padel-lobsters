// Helpers for the registration-transfer share flow.
//
// Two share actions are supported:
//   1. Direct WhatsApp message to the recipient (only when their stored phone
//      passes E.164 validation — wa.me requires a country-coded number).
//   2. Post in the Padel Lobsters WhatsApp group. The wa.me protocol cannot
//      pre-fill messages into a group chat, so the group flow copies the
//      message to the clipboard first and then opens the group URL — the
//      sender pastes manually.
//
// Production base URL for the deep link in the WhatsApp message. The app
// is reachable at the apex domain (padelobsters.nl). Deep links use
// react-router paths (/transfer/:id, /events/:id). Legacy ?transfer=<id>
// links sent in old WhatsApp messages still work — App.jsx redirects them
// to the new path on first paint.

export const APP_BASE_URL = 'https://padelobsters.nl'
export const LOBSTERS_GROUP_URL = 'https://chat.whatsapp.com/KigGKm4ERxR3UY9uq0GH3f'

// E.164: leading '+', country code + subscriber digits, 8–15 digits total
// (per ITU-T E.164 recommendation). We strip spaces, dashes, and parens
// before checking so that "+31 6 12345678" or "+31-6-1234-5678" both pass.
export function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/[\s\-()]/g, '')
}

export function isE164(phone) {
  const s = normalizePhone(phone)
  return /^\+\d{8,15}$/.test(s)
}

// Build the deep link Melanie will tap from WhatsApp. Lands directly on
// the transfer-accept route. Legacy ?transfer=<id> links from older
// messages still resolve via App.jsx's DeepLinkMigrator.
export function buildTransferUrl(transferId) {
  return `${APP_BASE_URL}/transfer/${encodeURIComponent(transferId)}`
}

// Pre-filled message — wording locked with user 2026-05-03.
export function buildTransferMessage(toPlayerName, transferId) {
  const firstName = (toPlayerName || '').split(/\s+/)[0] || 'there'
  const url = buildTransferUrl(transferId)
  return (
    `Hi ${firstName}, can you please accept the transfer of my spot on ${url}? ` +
    `Thanks a lot — I'll share the payment link after you accept.`
  )
}

// Direct chat URL — opens WhatsApp to a 1:1 conversation with the recipient
// and pre-fills the message. Returns null if the phone isn't E.164-valid.
export function buildDirectChatUrl(phone, message) {
  if (!isE164(phone)) return null
  const cleaned = normalizePhone(phone).replace(/^\+/, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}

// Copy a string to the clipboard. Returns true on success. Falls back to
// the legacy execCommand path for older browsers / WebView contexts.
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older mobile webviews
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    console.warn('copyToClipboard failed:', e)
    return false
  }
}

// Open the Lobsters group invite URL. Caller is expected to have copied the
// message to clipboard first; we surface that as a side-effect here so the
// two-step UX is always atomic from the component's perspective.
export async function shareToLobstersGroup(message) {
  await copyToClipboard(message)
  window.open(LOBSTERS_GROUP_URL, '_blank', 'noopener,noreferrer')
}

// Open the direct WhatsApp chat to the recipient. Returns false (no-op) if
// the phone isn't E.164 — the calling component should hide the button in
// that case rather than relying on this fallback.
export function shareToDirectChat(phone, message) {
  const url = buildDirectChatUrl(phone, message)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
