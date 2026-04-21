import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { KeyRound, LogIn, MessageCircle, UserPlus, HelpCircle, ArrowLeft } from 'lucide-react'
import { isPublicPage } from '../lib/authPaths'
import SignupRequest from './SignupRequest'

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
 *      otherwise show the auth card.
 *
 * Auth card has three stacked modes (Phase 3):
 *   - signin   (default): PIN entry.
 *   - signup:  self-serve. Creates a players row via the self_signup_player
 *              RPC and auto-logs in with the returned PIN.
 *   - forgot:  WhatsApp-the-admin deep link. No auto-reset flow yet —
 *              matches the "leave pin-only auth simple" product brief.
 */
export default function VerificationGate({ children, page }) {
  const { role, loading, loginWithPin } = useApp()

  const [mode, setMode]   = useState('signin')   // signin | signup | forgot
  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)
  const inputRef          = useRef(null)

  // Focus the PIN input whenever the gate returns to the signin mode so
  // mobile keyboards pop up ready to type.
  useEffect(() => {
    if (mode === 'signin' && role === 'guest' && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [mode, role, loading])

  if (loading) return null
  if (isPublicPage(page)) return <>{children}</>
  if (role !== 'guest')   return <>{children}</>

  const handleSignin = async (e) => {
    e?.preventDefault?.()
    if (busy || !pin) return
    setBusy(true); setError('')
    const result = await loginWithPin(pin)
    if (!result?.success) {
      setError(result?.error || "That PIN didn't match any Lobster. Try again.")
      setPin('')
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 10)
      return
    }
    // Success: role flips, this component unmounts, children render.
    setBusy(false)
  }

  // Signup mode renders the full rich profile form (aligned with the old
  // in-app Join form), which needs a wider card to fit two-column rows like
  // First Name / Last Name. Sign-in and Forgot keep the tighter width.
  const cardWidth = mode === 'signup' ? 'max-w-md' : 'max-w-sm'

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-lobster-teal via-teal-700 to-teal-900 flex flex-col items-center justify-center p-6 z-[100] overflow-y-auto">
      <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-2xl w-full ${cardWidth} space-y-5 my-6`}>
        {/* Brand — shown across all three modes so the surface feels consistent */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lobster-cream mb-3">
            <span className="text-4xl">🦞</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-800">Padel Lobsters</h1>
          <p className="text-xs text-gray-500 mt-1">
            {mode === 'signin' && 'Sign in with your 4-digit PIN to continue.'}
            {mode === 'signup' && 'New here? Set up your Lobster profile.'}
            {mode === 'forgot' && "Lost your PIN? We'll get you back in."}
          </p>
        </div>

        {/* ── Mode: SIGN IN ──────────────────────────────────────────────── */}
        {mode === 'signin' && (
          <>
            <form onSubmit={handleSignin} className="space-y-3">
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

            {/* Secondary options. Stack order matches the product brief:
                Sign up directly under the PIN button, Forgot PIN under that. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setPin('') }}
                className="w-full text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <UserPlus size={14} />
                Sign up
              </button>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError('') }}
                className="w-full text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <HelpCircle size={14} />
                Forgot your PIN?
              </button>
            </div>
          </>
        )}

        {/* ── Mode: SIGN UP ──────────────────────────────────────────────── */}
        {mode === 'signup' && (
          <SignupRequest
            compact
            onBack={() => setMode('signin')}
            // After successful signup the RPC returns a PIN and we auto-login;
            // AppContext flips the role, this component unmounts. No explicit
            // navigation needed here.
            onComplete={() => { /* no-op — role change unmounts the gate */ }}
          />
        )}

        {/* ── Mode: FORGOT PIN ───────────────────────────────────────────── */}
        {mode === 'forgot' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="text-sm text-gray-600 hover:text-lobster-teal flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to sign in
            </button>

            <p className="text-sm text-gray-700 leading-snug">
              Message an admin on WhatsApp and they'll reset your PIN and
              send you a new one.
            </p>

            <a
              href={`https://wa.me/${ADMIN_RESET_PHONE}?text=${encodeURIComponent(ADMIN_RESET_MSG)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1fba59] py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle size={14} />
              Message the admin on WhatsApp
            </a>

            <p className="text-[11px] text-gray-400 leading-snug">
              Tip: if you signed up with an email you still remember, try
              the Sign up form instead — we'll recognise your email and hand
              back the same PIN.
            </p>
          </div>
        )}
      </div>

      {mode === 'signin' && (
        <p className="text-[11px] text-white/60 mt-6 text-center">
          You need to sign in once on this device. We'll remember you after.
        </p>
      )}
    </div>
  )
}
