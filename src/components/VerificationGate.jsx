import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { KeyRound, LogIn, UserPlus, ArrowLeft, Mail, Check, AlertCircle } from 'lucide-react'
import { isPublicPath } from '../lib/authPaths'
import SignupRequest from './SignupRequest'

// Recovery + alternative sign-in is now via emailed magic link.
// Users without an email on file are directed to mail
// pin@padelobsters.nl so an admin can set one for them.

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
export default function VerificationGate({ children }) {
  const { role, loading, loginWithPin, sendMagicLink } = useApp()
  const location = useLocation()

  const [mode, setMode] = useState('signin') // signin | signup | magic
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  // Forgot-PIN flow state. Two sub-states:
  //   form  - email input, default; also where contact_admin errors land
  //           inline (no separate "go contact admin" page)
  //   sent  - "check your inbox" success
  // Phase 2d: removed the WhatsApp-fallback stage — email-mismatch is
  // now an inline error pointing to pin@padelobsters.nl, which keeps
  // recovery on the same self-service rail rather than dead-ending at
  // an admin handoff.
  const [magicEmail, setMagicEmail] = useState('')
  const [magicStage, setMagicStage] = useState('form') // form | sent
  const [magicBusy, setMagicBusy] = useState(false)
  const [magicError, setMagicError] = useState('')
  const [magicSentTo, setMagicSentTo] = useState('')

  // Incremented every time the user enters signup mode. Passed as the
  // `key` on <SignupRequest/> so React treats each entry as a fresh
  // mount — that's what re-rolls the rotating "Battle Cry / Trash Talk /
  // War Cry" lobby prompt. Without the key bump, React can preserve the
  // existing SignupRequest instance across rapid mode toggles and the
  // prompt gets stuck on whatever was picked the first time.
  const [signupKey, setSignupKey] = useState(0)
  const enterSignup = () => {
    setMode('signup')
    setError('')
    setPin('')
    setSignupKey((k) => k + 1)
  }

  // Ref to the scrollable overlay. Needed because when the user switches
  // into signup mode the form grows ~3x taller — on mobile the browser
  // preserves the previous scroll position (or scrolls a focused field
  // into view), so the card lands 1/3 down the page with "Country" at the
  // top instead of the "Padel Lobsters" header. We reset scrollTop=0 on
  // every mode change so the new surface always opens at the top.
  const scrollRef = useRef(null)

  // Focus the PIN input whenever the gate returns to the signin mode so
  // mobile keyboards pop up ready to type.
  useEffect(() => {
    if (mode === 'signin' && role === 'guest' && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [mode, role, loading])

  // Reset the overlay's scroll position every time the mode changes.
  // Runs after the mode-change render commits, so the new form's height
  // is already laid out. Two kicks are intentional:
  //   1. Immediate scrollTop=0 — covers the common case.
  //   2. A requestAnimationFrame follow-up — iOS Safari occasionally
  //      adjusts scroll after focus changes (mode switch can unfocus the
  //      previous PIN input), so we re-pin to the top after the browser
  //      has finished its own fiddling.
  // Both the overlay scroll and the window scroll are reset, because
  // Android Chrome sometimes scrolls the outer document when the virtual
  // keyboard dismisses.
  useEffect(() => {
    const toTop = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      } catch {
        /* older browsers */
      }
    }
    toTop()
    const raf = requestAnimationFrame(toTop)
    return () => cancelAnimationFrame(raf)
  }, [mode])

  if (loading) return null
  if (isPublicPath(location.pathname)) return <>{children}</>
  if (role !== 'guest') return <>{children}</>

  const handleSignin = async (e) => {
    e?.preventDefault?.()
    if (busy || !pin) return
    setBusy(true)
    setError('')
    const result = await loginWithPin(pin)
    if (!result?.success) {
      setError(result?.error || "That PIN didn't match any Lobster. Try again.")
      setPin('')
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 10)
      return
    }
    setBusy(false)
  }

  const resetMagicFlow = () => {
    setMagicEmail('')
    setMagicStage('form')
    setMagicBusy(false)
    setMagicError('')
    setMagicSentTo('')
  }

  const handleMagicSubmit = async (e) => {
    e?.preventDefault?.()
    if (magicBusy) return
    const email = magicEmail.trim()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMagicError('Please enter a valid email address.')
      return
    }
    setMagicBusy(true)
    setMagicError('')
    const result = await sendMagicLink(email)
    setMagicBusy(false)
    if (result === 'sent') {
      setMagicSentTo(email)
      setMagicStage('sent')
      return
    }
    if (result === 'unknown') {
      setMagicError(
        "We couldn't find that email in our records. Double-check the address. " +
          'If you never signed up with an email, write to pin@padelobsters.nl from ' +
          "your usual address and we'll add it to your account.",
      )
      return
    }
    if (result === 'invalid') {
      setMagicError('That email looks off — double-check the format.')
      return
    }
    setMagicError('Something went wrong. Try again in a moment.')
  }

  // Signup mode renders the full rich profile form (aligned with the old
  // in-app Join form), which needs a wider card to fit two-column rows like
  // First Name / Last Name. Sign-in and Forgot keep the tighter width.
  const cardWidth = mode === 'signup' ? 'max-w-md' : 'max-w-sm'

  // Anchor the card to the top whenever the form is taller than the viewport
  // (signup), on every device. `justify-center` on a tall child overflows
  // *above* the scroll origin, which is how desktop users reported seeing
  // First Name at the top of the screen with the "Padel Lobsters" header
  // cut off. Sign-in and Forgot are short forms, so we can still center
  // those vertically on desktop.
  const alignClasses =
    mode === 'signup'
      ? 'items-start justify-start'
      : 'items-start sm:items-center justify-start sm:justify-center'

  return (
    <div
      ref={scrollRef}
      className={`fixed inset-0 bg-gradient-to-br from-lobster-teal via-teal-700 to-teal-900 flex flex-col ${alignClasses} p-6 z-[100] overflow-y-auto`}
    >
      <div
        className={`bg-white rounded-3xl p-6 sm:p-8 shadow-2xl w-full ${cardWidth} space-y-5 my-6 mx-auto`}
      >
        {/* Brand — shown across all three modes so the surface feels consistent */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lobster-cream mb-3">
            <span className="text-4xl">🦞</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-800">Padel Lobsters</h1>
          <p className="text-xs text-gray-500 mt-1">
            {mode === 'signin' && 'Sign in with your 4-digit PIN to continue.'}
            {mode === 'signup' && 'New here? Set up your Lobster profile.'}
            {mode === 'magic' && "We'll email you a one-tap sign-in link."}
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
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''))
                    setError('')
                  }}
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
                onClick={enterSignup}
                className="w-full text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <UserPlus size={14} />
                Sign up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('magic')
                  setError('')
                  resetMagicFlow()
                }}
                className="w-full text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Mail size={14} />
                Email me a sign-in link
              </button>
            </div>
          </>
        )}

        {/* ── Mode: SIGN UP ──────────────────────────────────────────────── */}
        {mode === 'signup' && (
          <SignupRequest
            key={signupKey}
            compact
            onBack={() => setMode('signin')}
            // After successful signup the RPC returns a PIN and we auto-login;
            // AppContext flips the role, this component unmounts. No explicit
            // navigation needed here.
            onComplete={() => {
              /* no-op — role change unmounts the gate */
            }}
          />
        )}

        {/* ── Mode: MAGIC LINK ───────────────────────────────────────────── */}
        {mode === 'magic' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                resetMagicFlow()
              }}
              className="text-sm text-gray-600 hover:text-lobster-teal flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to sign in
            </button>

            {magicStage === 'form' && (
              <>
                <p className="text-sm text-gray-700 leading-snug">
                  Enter the email on your Lobster account and we'll send you a one-tap sign-in link.
                  Use this if you've forgotten your PIN or just prefer email. Didn't sign up with an
                  email? Write to{' '}
                  <a
                    href="mailto:pin@padelobsters.nl"
                    className="text-lobster-teal font-semibold underline-offset-2 hover:underline"
                  >
                    pin@padelobsters.nl
                  </a>{' '}
                  from your usual address and we'll add it to your account.
                </p>

                <form onSubmit={handleMagicSubmit} className="space-y-3">
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Mail size={12} className="text-lobster-teal" /> Your email
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={magicEmail}
                      onChange={(e) => {
                        setMagicEmail(e.target.value)
                        setMagicError('')
                      }}
                      placeholder="you@example.com"
                      className="input"
                      aria-label="Email"
                    />
                    {magicError && (
                      <p className="text-xs text-red-500 font-medium mt-2 flex items-start gap-1">
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{magicError}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={magicBusy || !magicEmail.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Mail size={14} />
                    {magicBusy ? 'Sending…' : 'Email me a sign-in link'}
                  </button>
                </form>
              </>
            )}

            {magicStage === 'sent' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-lobster-cream border border-lobster-teal/30 p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-lobster-teal">
                    <Check size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-lobster-teal">Check your inbox</p>
                    <p className="text-xs text-gray-600 mt-1 leading-snug">
                      We sent a sign-in link to{' '}
                      <span className="font-semibold break-all">{magicSentTo}</span>. Tap it from
                      this device and you'll be signed in. Check spam if it doesn't show up.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    resetMagicFlow()
                  }}
                  className="w-full text-sm font-semibold text-lobster-teal bg-white border border-lobster-teal/30 hover:bg-lobster-cream py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <LogIn size={14} />
                  Back to sign in
                </button>
              </div>
            )}
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
