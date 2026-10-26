import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import type { AuthError, EmailOtpType } from '@supabase/auth-js'
import { supabase } from '../supabase'
import { useApp } from '../context/useApp'
import { PasswordForm } from '../features/auth/PasswordForm'
import { isSafeReturnPath, takeReturnPath } from '../features/auth/returnPath'
import { Button } from './ui/Button'

type Status = 'ready' | 'verifying' | 'error' | 'email_change_confirmed' | 'set_password'

function friendlyVerifyError(err: AuthError): string {
  const msg = (err.message ?? '').toLowerCase()
  if (msg.includes('expired')) return 'This link has expired. Request a new one.'
  if (msg.includes('invalid') || msg.includes('not found')) {
    return 'This link is no longer valid. Request a new one.'
  }
  return err.message ?? 'Could not complete verification.'
}

const readyTitle = ({ type }: { type: EmailOtpType }) =>
  type === 'email_change' ? 'Confirm your email change' : 'Almost there'

const readyButton = ({ type }: { type: EmailOtpType }) => {
  if (type === 'email_change') return 'Tap to confirm the change'
  return type === 'recovery' ? 'Tap to choose a new password' : 'Tap to finish signing in'
}

function recoveryView({
  session,
  sessionSettled,
}: {
  session: unknown
  sessionSettled: boolean
}): Status {
  if (session) return 'set_password'
  return sessionSettled ? 'error' : 'verifying'
}

const RESET_ENDED_ERROR =
  'Your reset session has ended. Ask for a new reset code from the sign-in screen.'

const MISSING_TOKEN_ERROR = 'This link is missing its verification token. Request a new email.'

// Landing route for any auth email link. The template embeds token_hash + type.
// Verification waits for a tap: mail scanners (Outlook Safe Links, Defender)
// execute links, and an automatic verify would burn the single-use token before
// the person clicks.
//
// Sign-in types go to the saved return path, then `next`, then /home. A recovery
// link lands on "Set a new password". email_change stops on a confirmation
// screen: the change applies on the first redemption (GoTrue v2.189 collapses
// the double confirm for the token_hash flow), so the second email's link
// reports "expired", as expected.
//
// `?verified=1` arrives from the in-app reset code, which is already verified:
// the session exists and only the new password is missing.
//
// useAuth's onAuthStateChange listener owns the post-sign-in side effects.
export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { session, sessionSettled } = useApp()
  const type = (params.get('type') ?? 'magiclink') as EmailOtpType
  const tokenHash = params.get('token_hash')
  const verifiedRecovery = params.get('verified') === '1' && type === 'recovery' && !tokenHash
  const [status, setStatus] = useState<Status>(tokenHash ? 'ready' : 'error')
  const [error, setError] = useState(
    tokenHash ? '' : verifiedRecovery ? RESET_ENDED_ERROR : MISSING_TOKEN_ERROR,
  )
  const view = verifiedRecovery ? recoveryView({ session, sessionSettled }) : status

  const goToDestination = () => {
    const next = params.get('next')
    navigate(takeReturnPath() ?? (isSafeReturnPath(next) ? next : '/home'), { replace: true })
  }

  async function confirm() {
    if (!tokenHash) return
    setStatus('verifying')
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (verifyError) {
      console.error('verifyOtp error:', verifyError)
      setError(friendlyVerifyError(verifyError))
      setStatus('error')
      return
    }
    if (type === 'email_change') setStatus('email_change_confirmed')
    else if (type === 'recovery') setStatus('set_password')
    else goToDestination()
  }

  if (view === 'error') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-coral/30 bg-white p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-lob-coral" />
        <h2 className="mt-3 text-xl font-semibold text-lob-dark">Link didn't work</h2>
        <p className="mt-2 text-sm text-lob-muted">{error}</p>
        <div className="mt-5">
          <Button onClick={() => navigate('/home', { replace: true })}>Back to home</Button>
        </div>
      </div>
    )
  }

  if (view === 'email_change_confirmed') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-teal/20 bg-white p-6 text-center shadow-sm">
        <Check className="mx-auto h-10 w-10 text-lob-teal" />
        <h2 className="mt-3 text-xl font-semibold text-lob-dark">Email updated</h2>
        <p className="mt-2 text-sm text-lob-muted">
          Your Padel Lobsters email has been changed. The matching email we sent to your previous
          address was just a heads-up — you can safely ignore (or delete) that one.
        </p>
        <div className="mt-5">
          <Button onClick={() => navigate('/account', { replace: true })}>Back to account</Button>
        </div>
      </div>
    )
  }

  if (view === 'set_password') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-teal/20 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-lob-dark text-center">Set a new password</h2>
        <PasswordForm
          requireCurrentPassword={false}
          submitLabel="Save password"
          onDone={goToDestination}
        />
      </div>
    )
  }

  if (view === 'ready') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-teal/20 bg-white p-6 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-lob-dark">{readyTitle({ type })}</h2>
        <div className="mt-5">
          <Button onClick={confirm}>{readyButton({ type })}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-lob-teal/20 bg-white p-6 text-center shadow-sm">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-lob-teal" />
      <h2 className="mt-3 text-xl font-semibold text-lob-dark">Just a moment…</h2>
      <p className="mt-2 text-sm text-lob-muted">Verifying your link.</p>
    </div>
  )
}
