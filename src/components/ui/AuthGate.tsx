import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import { useApp } from '../../context/useApp'
import { X, Mail } from 'lucide-react'
import SignInForm from '../../features/auth/SignInForm'
import { sessionRole } from '../../features/auth/sessionClaims'
import { TextButton } from './TextButton'
import { IconButton } from './IconButton'
import { AlertBox } from './AlertBox'

// The sign-in modal and the hook that gates an action behind it. A signed-out
// stand-in for content is `SignInPrompt`.
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
  const { role: appRole } = useApp()
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (open && roleSatisfies({ required: role, role: appRole })) onClose?.()
  }, [open, role, appRole, onClose])

  if (!open) return null

  const handleSignedIn = (signedInSession: Session) => {
    const signedInRole = sessionRole({ session: signedInSession })
    // A role-less session runs nothing: the session check takes over.
    if (signedInRole === 'guest') {
      onClose?.()
      return
    }
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
  const accentBg = isAdminAsk ? 'bg-lob-warning-light' : 'bg-lob-cream'
  const accentTxt = isAdminAsk ? 'text-lob-warning' : 'text-lob-teal'

  // Portalled so a parent's `space-y` margin can't offset the fixed backdrop.
  return createPortal(
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
          <IconButton onClick={onClose} aria-label="Close" variant="ghost">
            <X />
          </IconButton>
        </div>

        <p className="text-sm text-lob-muted">
          {subtitle || "Sign in with your email. We'll send you a code."}
        </p>

        {notice && (
          <AlertBox variant="error" size="sm">
            {notice}
          </AlertBox>
        )}

        <SignInForm
          variant="modal"
          initialEmail={initialEmail}
          onSignedIn={handleSignedIn}
          allowPin={false}
        />

        {onNavigate && (
          <div className="text-center">
            <TextButton tone="neutral" onClick={goToSettings}>
              Manage profile in Settings →
            </TextButton>
          </div>
        )}
      </div>
    </div>,
    document.body,
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
  const { role: userRole } = useApp()
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
