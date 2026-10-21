import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { UserPlus } from 'lucide-react'
import { isPublicPath } from '../lib/authPaths'
import { RouteFallback } from './ui/RouteFallback'
import SignInForm from '../features/auth/SignInForm'
import { parseSignInDeepLink } from '../features/auth/useSignInDeepLink'

// The gate itself is entry-critical — it decides what the first paint shows.
// The signup form is not: it only renders once someone taps "sign up", and it
// carries the country picker with it.
const SignupRequest = lazy(() => import('./SignupRequest'))

/**
 * Verification gate.
 *
 * Wraps the page render inside App. Three outcomes, in order:
 *
 *   1. AppContext is still hydrating → render nothing (avoid UI flash).
 *   2. Current page is in PUBLIC_PAGES (see src/lib/authPaths.js) → render
 *      children regardless of role. Guests can browse upcoming tournaments,
 *      event detail, and any other allowlisted surface without signing in.
 *   3. Current page is protected (default) → require a non-guest role;
 *      otherwise show the auth card.
 *
 * Auth card modes:
 *   - signin (default): SignInForm (email code, password, or PIN until the sunset).
 *   - signup: self-serve native signup (email code).
 */
type GateMode = 'signin' | 'signup'

export default function VerificationGate({ children }: { children?: React.ReactNode }) {
  const { role, sessionSettled } = useApp()
  const location = useLocation()
  const [mode, setMode] = useState<GateMode>('signin')
  const [initialEmail] = useState(() => parseSignInDeepLink({ search: location.search }).email)

  // Incremented every time the user enters signup mode. Passed as the
  // `key` on <SignupRequest/> so React treats each entry as a fresh
  // mount — that's what re-rolls the rotating "Battle Cry / Trash Talk /
  // War Cry" lobby prompt.
  const [signupKey, setSignupKey] = useState(0)
  const enterSignup = () => {
    setMode('signup')
    setSignupKey((k) => k + 1)
  }

  // Switching into signup grows the card ~3x; the browser keeps the old scroll
  // position, so reset the overlay and window to the top on every mode change.
  // The rAF follow-up re-pins after iOS Safari's own post-focus adjustment.
  const scrollRef = useRef<HTMLDivElement>(null)
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

  // Hold children back until auth has resolved: role is 'guest' until then,
  // so rendering early flashes the sign-in overlay at an already-signed-in user.
  if (!sessionSettled) return null
  if (isPublicPath(location.pathname)) return <>{children}</>
  if (role !== 'guest') return <>{children}</>

  // Signup renders the full profile form, which needs a wider card. Anchor it
  // to the top: `justify-center` on a tall child overflows above the scroll
  // origin and cuts off the header.
  const cardWidth = mode === 'signup' ? 'max-w-md' : 'max-w-sm'
  const alignClasses =
    mode === 'signup'
      ? 'items-start justify-start'
      : 'items-start sm:items-center justify-start sm:justify-center'

  return (
    <div
      ref={scrollRef}
      className={`fixed inset-0 bg-gradient-to-br from-lob-teal via-teal-700 to-teal-900 flex flex-col ${alignClasses} p-6 z-[100] overflow-y-auto`}
    >
      <div
        className={`bg-white rounded-3xl p-6 sm:p-8 shadow-2xl w-full ${cardWidth} space-y-5 my-6 mx-auto`}
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lob-cream mb-3">
            <span className="text-4xl">🦞</span>
          </div>
          <h1 className="text-xl font-extrabold text-lob-dark">Padel Lobsters</h1>
          <p className="text-xs text-lob-muted mt-1">
            {mode === 'signin' && 'Sign in with your email to continue.'}
            {mode === 'signup' && 'New here? Set up your Lobster profile.'}
          </p>
        </div>

        {mode === 'signin' && (
          <>
            <SignInForm variant="page" initialEmail={initialEmail} allowPin />
            <button
              type="button"
              onClick={enterSignup}
              className="w-full text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <UserPlus size={14} />
              New here? Sign up
            </button>
          </>
        )}

        {mode === 'signup' && (
          <Suspense fallback={<RouteFallback />}>
            <SignupRequest key={signupKey} compact onBack={() => setMode('signin')} />
          </Suspense>
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
