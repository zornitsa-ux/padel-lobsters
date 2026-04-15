import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Shield, User, LogIn, X, KeyRound } from 'lucide-react'

/**
 * Site-wide auth middleware.
 *
 * Wraps a section or action that requires a given role. When the current
 * session satisfies the role, the children render normally. Otherwise a
 * single, consistent banner appears with a one-tap deep-link to
 * Settings → Account so the user signs in ONCE and their session carries
 * across every page — no more per-page modal prompts.
 *
 * Props
 *   role        'admin' | 'player' — who is allowed to see the children
 *   onNavigate  the app-level navigate fn (required so "Go to Settings" works)
 *   message     optional override for the banner body copy
 *   compact     render a slim inline banner rather than a full card
 *   fallback    if provided, render this instead of the default banner
 *               (e.g. `null` to hide entirely)
 */
export default function AuthGate({ role, onNavigate, message, compact, fallback, children }) {
  const { isAdmin, claimedId } = useApp()

  const allowed =
    role === 'admin'  ? isAdmin :
    role === 'player' ? !!claimedId || isAdmin : // admin counts as a superset
    true

  if (allowed) return <>{children}</>
  if (fallback !== undefined) return fallback
  return (
    <SignInBanner role={role} onNavigate={onNavigate} message={message} compact={compact} />
  )
}

/**
 * Standalone banner — exported so pages can surface it at the top of a
 * section without wrapping children (e.g. "read-only view" notices).
 */
export function SignInBanner({ role, onNavigate, message, compact }) {
  const isAdmin = role === 'admin'
  const Icon    = isAdmin ? Shield : User
  const accent  = isAdmin ? 'amber' : 'teal'

  const bg      = accent === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-lobster-cream border-lobster-teal/30'
  const iconTxt = accent === 'amber' ? 'text-amber-600'              : 'text-lobster-teal'
  const title   = accent === 'amber' ? 'text-amber-800'              : 'text-lobster-teal'
  const body    = accent === 'amber' ? 'text-amber-700'              : 'text-gray-600'

  const defaultCopy = isAdmin
    ? 'Sign in as admin from Settings → Account to manage this.'
    : "Sign in from Settings → Account to post, react, or place orders — it's just your 4-digit PIN."

  const goToSettings = () => onNavigate?.('settings')

  if (compact) {
    return (
      <div className={`rounded-xl border ${bg} p-2.5 flex items-center gap-2`}>
        <Icon size={14} className={iconTxt + ' flex-shrink-0'} />
        <p className={`text-xs ${body} flex-1`}>{message || defaultCopy}</p>
        <button
          onClick={goToSettings}
          className="text-xs font-semibold text-lobster-teal bg-white px-2.5 py-1 rounded-lg active:scale-95 transition-all flex items-center gap-1"
        >
          <LogIn size={11} /> Sign in
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border ${bg} p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 ${iconTxt}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${title}`}>
          {isAdmin ? 'Admin sign-in required' : 'Verify your identity'}
        </p>
        <p className={`text-xs ${body} mt-0.5`}>{message || defaultCopy}</p>
        <button
          onClick={goToSettings}
          className="mt-2 text-xs font-bold text-white bg-lobster-teal px-3 py-1.5 rounded-lg active:scale-95 transition-all inline-flex items-center gap-1"
        >
          <LogIn size={12} /> Go to Settings
        </button>
      </div>
    </div>
  )
}

/**
 * Thin helper hook for imperative call-sites (e.g. "on click, if not admin
 * redirect to settings"). Returns a fn that returns true when allowed and
 * navigates away when not — so existing `if (!isAdmin) { setShowLogin(true) }`
 * patterns become `if (!requireRole('admin')) return`.
 */
export function useRequireRole(onNavigate) {
  const { isAdmin, claimedId } = useApp()
  return (role) => {
    const ok =
      role === 'admin'  ? isAdmin :
      role === 'player' ? !!claimedId || isAdmin :
      true
    if (!ok) onNavigate?.('settings')
    return ok
  }
}

/**
 * The PIN prompt modal — single inline sign-in surface used everywhere a
 * player (or admin) clicks something that requires identity. They can also
 * always go to Settings → Account to sign in / out, but this lets us nudge
 * just-in-time without breaking the flow.
 *
 * Uses the same PIN auto-detect as Settings (admin PIN OR a player PIN).
 */
export function PinPrompt({ open, onClose, onSuccess, role = 'player', title, subtitle, onNavigate }) {
  const { loginWithPin, logout } = useApp()
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)
  const inputRef              = useRef(null)

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
      setBusy(false)
      // Focus on next tick so iOS pulls up the numeric keyboard
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (busy) return
    setBusy(true)
    const result = await loginWithPin(pin)
    if (result.success) {
      // Role mismatch guards.
      if (role === 'admin' && result.role !== 'admin') {
        setError("That's a player PIN — admin PIN required for this action.")
        setBusy(false)
        return
      }
      // Don't silently elevate to admin from a player-only prompt.
      // Admins reach admin mode through Settings → Group owner access.
      if (role === 'player' && result.role === 'admin') {
        logout()
        setError("That doesn't look like your Lobster PIN. Try again.")
        setBusy(false)
        return
      }
      onSuccess?.(result)
      onClose?.()
    } else {
      setError(result.error || 'Invalid PIN')
      setBusy(false)
    }
  }

  const goToSettings = () => {
    onClose?.()
    onNavigate?.('settings')
  }

  const isAdminAsk = role === 'admin'
  const accent     = isAdminAsk ? 'amber' : 'teal'
  const accentBg   = accent === 'amber' ? 'bg-amber-50'           : 'bg-lobster-cream'
  const accentTxt  = accent === 'amber' ? 'text-amber-700'        : 'text-lobster-teal'

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${accentBg} flex items-center justify-center`}>
              <KeyRound size={15} className={accentTxt} />
            </div>
            <h3 className="font-bold text-gray-800">{title || (isAdminAsk ? 'Admin PIN' : 'Enter your PIN')}</h3>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-500">
          {subtitle || (isAdminAsk
            ? 'Enter the admin PIN to continue.'
            : 'Enter your 4-digit PIN — you only need to do this once on this device.')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
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
          />
          {error && (
            <p className="text-xs text-lob-coral font-medium text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy || !pin}
            className="btn-primary w-full disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Sign in 🦞'}
          </button>
        </form>

        {onNavigate && (
          <button
            onClick={goToSettings}
            className="w-full text-xs text-gray-500 underline-offset-2 hover:underline"
          >
            Manage profile in Settings →
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The hook every page uses to gate an action behind a PIN prompt.
 *
 *   const { requireAuth, AuthPromptModal } = useAuthPrompt({ onNavigate })
 *   ...
 *   <AuthPromptModal />
 *   <button onClick={() => requireAuth('player', () => doThing())}>Tap me</button>
 *
 * If the user is already signed in with the required role, the callback runs
 * immediately. Otherwise the modal opens, and the callback runs after a
 * successful sign-in.
 */
export function useAuthPrompt({ onNavigate } = {}) {
  const { isAdmin, claimedId } = useApp()
  const [open, setOpen]         = useState(false)
  const [askRole, setAskRole]   = useState('player')
  const [askTitle, setAskTitle] = useState(null)
  const [askSub, setAskSub]     = useState(null)
  const pendingRef              = useRef(null)

  const requireAuth = useCallback((role, cb, options = {}) => {
    const ok =
      role === 'admin'  ? isAdmin :
      role === 'player' ? !!claimedId || isAdmin :
      true
    if (ok) {
      cb?.()
      return
    }
    pendingRef.current = cb
    setAskRole(role || 'player')
    setAskTitle(options.title || null)
    setAskSub(options.subtitle || null)
    setOpen(true)
  }, [isAdmin, claimedId])

  const handleSuccess = useCallback(() => {
    const cb = pendingRef.current
    pendingRef.current = null
    // Run after the modal closes so any UI state the cb sets renders cleanly
    setTimeout(() => cb?.(), 0)
  }, [])

  const AuthPromptModal = useCallback(() => (
    <PinPrompt
      open={open}
      onClose={() => setOpen(false)}
      onSuccess={handleSuccess}
      role={askRole}
      title={askTitle}
      subtitle={askSub}
      onNavigate={onNavigate}
    />
  ), [open, askRole, askTitle, askSub, onNavigate, handleSuccess])

  return { requireAuth, AuthPromptModal }
}
