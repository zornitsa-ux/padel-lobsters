import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { KeyRound, LogIn, MessageCircle } from 'lucide-react'
import { isPublicPage } from '../lib/authPaths'

// WhatsApp contact for PIN-reset requests. wa.me wants digits only, no +.
const ADMIN_RESET_PHONE = '56997442387'
const ADMIN_RESET_MSG   = 'Hi Lobster Admin 🦀 I forgot my Padel Lobsters PIN — could you reset it and send me a new one? Thanks!'

/**
 * Verification gate.
 *
 * Wraps the page render inside App. Three outcomes, in order:
 *
 *   1. AppContext is still hydrating → render nothing (avoid UI flash).
 *   2. Current page is in PUBLIC_PAGES (see src/lib/authPaths.js) → render
 *      children regardless of role. Guests can browse upcoming tournaments,
 *      event detail, and any other allowlisted surface without a PIN.
 *   3. Current page is protected (default) → require a non-guest role;
 *      otherwise show the full-screen PIN prompt.
 *
 * Why a `page` prop: the allowlist is keyed by page name. App.jsx is the
 * component that knows which page is active, so it passes it in.
 *
 * Once signed in, the PIN is remembered in localStorage by AppContext, so
 * the gate disappears for the session and doesn't come back unless the
 * user logs out from Settings.
 */
export default function VerificationGate({ children, page }) {
  const { role, loading, loginWithPin } = useApp()

  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)
  const inputRef          = useRef(null)

  // Focus the PIN input as soon as the gate mounts (and every time the gate
  // becomes visible after a failed sign-in). iOS pulls up the numeric keyboard.
  useEffect(() => {
    if (role === 'guest' && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [role, loading])

  // While the context is hydrating (reading localStorage, fetching players),
  // don't flash the gate — render nothing so we don't paint the wrong state.
  if (loading) return null

  // Public pages are rendered for everyone, including guests. The allowlist
  // lives in src/lib/authPaths.js (default-deny: unknown pages are protected).
  // Components under a public page MUST read only PII-free data — for tournament
  // data that means the `public_tournaments` view, not the raw table. See
  // supabase-migration-v24-public-browsing.sql.
  if (isPublicPage(page)) return <>{children}</>

  if (role !== 'guest') return <>{children}</>

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (busy || !pin) return
    setBusy(true)
    setError('')
    const result = await loginWithPin(pin)
    if (!result?.success) {
      setError(result?.error || 'That PIN didn\'t match any Lobster. Try again.')
      setPin('')
      setBusy(false)
      // Re-focus so the numeric keypad stays up on mobile
      setTimeout(() => inputRef.current?.focus(), 10)
      return
    }
    // Success: the context updates, role becomes 'player' or 'admin', the
    // gate unmounts, children render.
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-lobster-teal via-teal-700 to-teal-900 flex flex-col items-center justify-center p-6 z-[100]">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl w-full max-w-sm space-y-5">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lobster-cream mb-3">
            <span className="text-4xl">🦞</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-800">Padel Lobsters</h1>
          <p className="text-xs text-gray-500 mt-1">Sign in with your 4-digit PIN to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label flex items-center gap-1.5">
              <KeyRound size={12} className="text-lobster-teal" /> Your PIN
            </label>
            <input
              ref={inputRef}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
              placeholder="••••"
              className="input text-center text-2xl tracking-[0.5em] font-bold"
              aria-label="PIN"
            />
            {error && (
              <p className="text-xs text-red-500 font-medium text-center mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !pin}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={14} />
            {busy ? 'Checking…' : 'Sign in 🦞'}
          </button>

          {/* Forgot PIN — opens WhatsApp with a pre-filled message to the
              admin. User still has to tap send; the admin then uses the
              Reset & Send PIN button on the Players page to issue a new
              PIN, which lands back in WhatsApp. */}
          <a
            href={`https://wa.me/${ADMIN_RESET_PHONE}?text=${encodeURIComponent(ADMIN_RESET_MSG)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <MessageCircle size={14} />
            Forgot your PIN? Message the admin
          </a>
        </form>

        <p className="text-[11px] text-gray-400 text-center leading-snug">
          Don't have a PIN yet? Ask an admin to register you — the PIN is
          chosen when your profile is created.
        </p>
      </div>

      <p className="text-[11px] text-white/60 mt-6 text-center">
        You need to sign in once on this device. We'll remember you after.
      </p>
    </div>
  )
}
