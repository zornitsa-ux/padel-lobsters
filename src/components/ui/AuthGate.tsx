import { useState, useCallback, useRef, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useApp } from '../../context/useApp'
import { Shield, User, LogIn, X, Mail } from 'lucide-react'
import SignInForm from '../../features/auth/SignInForm'

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
export type GateRole = 'admin' | 'player'

// A fresh session may not carry its role yet (it syncs just after sign-in), so
// any signed-in session satisfies a player prompt.
export const roleSatisfies = ({ required, role }: { required: GateRole; role: string }) =>
  required === 'admin' ? role === 'admin' : role !== 'guest'

const ADMIN_REQUIRED_NOTICE = 'This needs an admin account.'

// The navigation callback these surfaces use ('settings' is the only
// destination they ever ask for).
export type GateNavigate = (destination: string) => void

/**
 * Standalone banner — exported so pages can surface it at the top of a
 * section without wrapping children (e.g. "read-only view" notices).
 */
export function SignInBanner({
  role,
  onNavigate,
  message,
  compact,
}: {
  role: GateRole
  onNavigate?: GateNavigate
  message?: string
  compact?: boolean
}) {
  const isAdmin = role === 'admin'
  const Icon = isAdmin ? Shield : User
  const accent = isAdmin ? 'amber' : 'teal'

  const bg = accent === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-lob-cream border-lob-teal/30'
  const iconTxt = accent === 'amber' ? 'text-amber-600' : 'text-lob-teal'
  const title = accent === 'amber' ? 'text-amber-800' : 'text-lob-teal'
  const body = accent === 'amber' ? 'text-amber-700' : 'text-lob-slate'

  const defaultCopy = isAdmin
    ? 'Sign in as admin from Settings → Account to manage this.'
    : "Sign in from Settings → Account to post, react, or place orders. We'll email you a code."

  const goToSettings = () => onNavigate?.('settings')

  if (compact) {
    return (
      <div className={`rounded-xl border ${bg} p-2.5 flex items-center gap-2`}>
        <Icon size={14} className={iconTxt + ' flex-shrink-0'} />
        <p className={`text-xs ${body} flex-1`}>{message || defaultCopy}</p>
        <button
          onClick={goToSettings}
          className="text-xs font-semibold text-lob-teal bg-white px-2.5 py-1 rounded-lg active:scale-95 transition-all flex items-center gap-1"
        >
          <LogIn size={11} /> Sign in
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border ${bg} p-4 flex items-start gap-3`}>
      <div
        className={`w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 ${iconTxt}`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${title}`}>
          {isAdmin ? 'Admin sign-in required' : 'Verify your identity'}
        </p>
        <p className={`text-xs ${body} mt-0.5`}>{message || defaultCopy}</p>
        <button
          onClick={goToSettings}
          className="mt-2 text-xs font-bold text-white bg-lob-teal px-3 py-1.5 rounded-lg active:scale-95 transition-all inline-flex items-center gap-1"
        >
          <LogIn size={12} /> Go to Settings
        </button>
      </div>
    </div>
  )
}

/**
 * The sign-in modal: the just-in-time surface for anything that needs identity.
 * Settings → Account stays the place to manage the account.
 */
export function SignInModal({
  open,
  onClose,
  onSuccess,
  role = 'player',
  title,
  subtitle,
  initialEmail,
  onNavigate,
}: {
  open: boolean
  onClose?: () => void
  onSuccess?: (session: Session) => void
  role?: GateRole
  title?: string | null
  subtitle?: string | null
  initialEmail?: string
  onNavigate?: GateNavigate
}) {
  const { role: sessionRole } = useApp()
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (open && roleSatisfies({ required: role, role: sessionRole })) onClose?.()
  }, [open, role, sessionRole, onClose])

  if (!open) return null

  const handleSignedIn = (signedInSession: Session) => {
    const signedInRole = signedInSession.user?.app_metadata?.role ?? 'player'
    if (!roleSatisfies({ required: role, role: signedInRole })) {
      setNotice(ADMIN_REQUIRED_NOTICE)
      return
    }
    onSuccess?.(signedInSession)
    onClose?.()
  }

  const goToSettings = () => {
    onClose?.()
    onNavigate?.('settings')
  }

  const isAdminAsk = role === 'admin'
  const accentBg = isAdminAsk ? 'bg-amber-50' : 'bg-lob-cream'
  const accentTxt = isAdminAsk ? 'text-amber-700' : 'text-lob-teal'

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${accentBg} flex items-center justify-center`}>
              <Mail size={15} className={accentTxt} />
            </div>
            <h3 className="font-bold text-lob-dark">{title || 'Sign in'}</h3>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={22} className="text-lob-muted-light" />
          </button>
        </div>

        <p className="text-sm text-lob-muted">
          {subtitle || "Sign in with your email. We'll send you a code."}
        </p>

        {notice && (
          <p role="alert" className="text-xs text-red-500 font-medium">
            {notice}
          </p>
        )}

        <SignInForm
          variant="modal"
          initialEmail={initialEmail}
          onSignedIn={handleSignedIn}
          allowPin={false}
        />

        {onNavigate && (
          <button
            onClick={goToSettings}
            className="w-full text-xs text-lob-muted underline-offset-2 hover:underline"
          >
            Manage profile in Settings →
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The hook every page uses to gate an action behind the sign-in modal.
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
export function useAuthPrompt({ onNavigate }: { onNavigate?: GateNavigate } = {}) {
  const { session } = useApp()
  const userRole = session?.user?.app_metadata?.role ?? 'guest'
  const isAdmin = userRole === 'admin'
  const isPlayer = userRole === 'player'
  const [open, setOpen] = useState(false)
  const [askRole, setAskRole] = useState<GateRole>('player')
  const [askTitle, setAskTitle] = useState<string | null>(null)
  const [askSub, setAskSub] = useState<string | null>(null)
  const pendingRef = useRef<(() => void) | null>(null)

  const requireAuth = useCallback(
    (
      role: GateRole,
      cb?: () => void,
      options: { title?: string; subtitle?: string } = {},
    ): void => {
      const ok = role === 'admin' ? isAdmin : role === 'player' ? isPlayer || isAdmin : true
      if (ok) {
        cb?.()
        return
      }
      pendingRef.current = cb ?? null
      setAskRole(role || 'player')
      setAskTitle(options.title || null)
      setAskSub(options.subtitle || null)
      setOpen(true)
    },
    [isAdmin, isPlayer],
  )

  const closeModal = useCallback(() => setOpen(false), [])

  const handleSuccess = useCallback(() => {
    const cb = pendingRef.current
    pendingRef.current = null
    // Run after the modal closes so any UI state the cb sets renders cleanly
    setTimeout(() => cb?.(), 0)
  }, [])

  // The latest props live in a ref so the component's identity stays stable:
  // a new onNavigate closure on every parent render must not remount the modal
  // (that would reset the form mid-code).
  const latest = useRef<Parameters<typeof SignInModal>[0]>({ open: false })
  latest.current = {
    open,
    onClose: closeModal,
    onSuccess: handleSuccess,
    role: askRole,
    title: askTitle,
    subtitle: askSub,
    onNavigate,
  }
  const AuthPromptModal = useCallback(() => <SignInModal {...latest.current} />, [])

  return { requireAuth, AuthPromptModal }
}
