import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { KeyRound, LogIn } from 'lucide-react'

/**
 * Hard verification gate.
 *
 * Wraps the entire app. When the user is not signed in as a player OR admin
 * (role === 'guest'), the children do NOT render — instead the gate shows
 * a full-screen PIN prompt. No browsing, no voting, no tournament registration,
 * no buttons of any kind until they've entered a valid PIN.
 *
 * Why this exists: we previously let guests navigate freely and silently
 * disabled actions (e.g. the Lobster Games vote button would just no-op for
 * unauthenticated users). That produced confusing "why doesn't my tap work?"
 * reports. Now the app is explicitly gated from the first paint.
 *
 * Once signed in, the PIN is remembered in localStorage by AppContext, so the
 * gate disappears for the session and doesn't come back unless the user logs
 * out from Settings.
 */
export default function VerificationGate({ children }) {
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
