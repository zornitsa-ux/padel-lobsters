import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Check, KeyRound, Mail } from 'lucide-react'
import { useApp } from '../../context/useApp'
import {
  currentSession,
  looksLikeEmail,
  normaliseEmail,
  requestEmailCode,
  sendPasswordReset,
  signInWithPassword,
} from './authActions'
import { describeSignInError, type AuthErrorLike, type SignInStep } from './authErrors'
import { takeReturnPath } from './returnPath'
import { FormError } from './FormError'
import { PasswordInput } from './PasswordInput'
import { OtpCodeStep } from './OtpCodeStep'
import { markPinSignIn } from './pinSignInFlag'
import { PIN_SUNSET_LABEL } from './pinSunset'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'

export interface SignInFormProps {
  variant: 'page' | 'modal' | 'inline'
  initialEmail?: string
  onSignedIn?: (session: Session) => void
  allowPin: boolean
}

type Step = 'email' | 'code' | 'password' | 'forgot' | 'recovery-code' | 'pin' | 'done'

const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.'

interface EmailFieldProps {
  email: string
  onChange: (email: string) => void
}

function EmailField({ email, onChange }: EmailFieldProps) {
  return (
    <div>
      <label htmlFor="signin-email" className="label flex items-center gap-1.5">
        <Mail size={12} className="text-lob-teal" /> Email
      </label>
      <input
        id="signin-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
        className="input"
      />
    </div>
  )
}

export function SignInForm({ variant, initialEmail = '', onSignedIn, allowPin }: SignInFormProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const firedRef = useRef(false)
  const navigate = useNavigate()
  const { loginWithPin } = useApp()

  function signedIn(session: Session) {
    if (firedRef.current) return
    firedRef.current = true
    takeReturnPath()
    setStep('done')
    onSignedIn?.(session)
  }

  function goTo(next: Step) {
    setError('')
    setStep(next)
  }

  async function submit({
    action,
    errorStep,
    onSuccess,
  }: {
    action: () => Promise<{ error: AuthErrorLike | null; session?: Session | null }>
    errorStep: SignInStep
    onSuccess: (session: Session | null | undefined) => void
  }) {
    if (busy) return
    if (!looksLikeEmail(address)) {
      setError(INVALID_EMAIL_MESSAGE)
      return
    }
    setBusy(true)
    setError('')
    const { error: actionError, session } = await action()
    setBusy(false)
    if (actionError) setError(describeSignInError({ error: actionError, step: errorStep }))
    else onSuccess(session)
  }

  const address = normaliseEmail(email)

  function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    void submit({
      action: () => requestEmailCode({ email: address }),
      errorStep: 'request',
      onSuccess: () => setStep('code'),
    })
  }

  function handleForgotSubmit(event: FormEvent) {
    event.preventDefault()
    void submit({
      action: () => sendPasswordReset({ email: address }),
      errorStep: 'reset',
      onSuccess: () => setStep('recovery-code'),
    })
  }

  function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    void submit({
      action: async () => {
        const { session, error: signInError } = await signInWithPassword({
          email: address,
          password,
        })
        return { session, error: signInError ?? (session ? null : {}) }
      },
      errorStep: 'password',
      onSuccess: (session) => session && signedIn(session),
    })
  }

  async function handlePinSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || !pin) return
    setBusy(true)
    setError('')
    const result = await loginWithPin(pin)
    setBusy(false)
    const session = result.success ? await currentSession() : null
    if (!session) {
      setPin('')
      setError(typeof result.error === 'string' && result.error ? result.error : 'Login failed')
      return
    }
    markPinSignIn()
    signedIn(session)
  }

  function handleRecoveryVerified() {
    navigate('/auth/confirm?type=recovery&verified=1')
  }

  return (
    <div className="space-y-4" data-variant={variant}>
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} noValidate className="space-y-3">
          <EmailField email={email} onChange={setEmail} />
          <FormError message={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </Button>
          <Button variant="neutral" size="sm" className="w-full" onClick={() => goTo('password')}>
            Sign in with password
          </Button>
          {allowPin && (
            <TextButton onClick={() => goTo('pin')}>
              Sign in with PIN (until {PIN_SUNSET_LABEL})
            </TextButton>
          )}
        </form>
      )}

      {step === 'code' && (
        <OtpCodeStep
          email={address}
          onVerified={signedIn}
          onChangeEmail={() => goTo('email')}
          resend={() => requestEmailCode({ email: address })}
        />
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} noValidate className="space-y-3">
          <EmailField email={email} onChange={setEmail} />
          <div>
            <label htmlFor="signin-password" className="label">
              Password
            </label>
            <PasswordInput
              id="signin-password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={busy || !password} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="flex items-center justify-between">
            <TextButton onClick={() => goTo('forgot')}>Forgot password?</TextButton>
            <TextButton onClick={() => goTo('email')}>Email me a code instead</TextButton>
          </div>
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={handleForgotSubmit} noValidate className="space-y-3">
          <p className="text-sm text-lob-slate leading-snug">
            Enter your email and we&rsquo;ll send you a code to choose a new password.
          </p>
          <EmailField email={email} onChange={setEmail} />
          <FormError message={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending…' : 'Send reset code'}
          </Button>
          <TextButton onClick={() => goTo('password')}>Back to password sign-in</TextButton>
        </form>
      )}

      {step === 'recovery-code' && (
        <OtpCodeStep
          email={address}
          type="recovery"
          submitLabel="Continue"
          onVerified={handleRecoveryVerified}
          onChangeEmail={() => goTo('forgot')}
          resend={() => sendPasswordReset({ email: address })}
        />
      )}

      {step === 'pin' && (
        <form onSubmit={handlePinSubmit} className="space-y-3">
          <label htmlFor="signin-pin" className="label flex items-center gap-1.5">
            <KeyRound size={12} className="text-lob-teal" /> Your PIN
          </label>
          <input
            id="signin-pin"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            placeholder="••••"
            className="input text-center text-2xl tracking-[0.5em] font-bold"
          />
          <FormError message={error} />
          <Button type="submit" disabled={busy || !pin} className="w-full">
            {busy ? 'Checking…' : 'Sign in with PIN'}
          </Button>
          <TextButton onClick={() => goTo('email')}>Use my email instead</TextButton>
        </form>
      )}

      {step === 'done' && (
        <p className="flex items-center gap-2 text-sm font-semibold text-lob-teal">
          <Check size={16} /> You&rsquo;re signed in
        </p>
      )}
    </div>
  )
}

export default SignInForm
