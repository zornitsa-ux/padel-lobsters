import { useRef, useState, type FormEvent } from 'react'
import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { Check } from 'lucide-react'
import { describeSignInError, rateLimitWaitSeconds } from './authErrors'
import { requestEmailCode, verifyEmailCode, type AuthResult } from './authActions'
import { FormError } from './FormError'
import { CODE_LENGTH, sanitiseCode } from './otpCode'
import { formatCountdown, useCountdown } from './useCountdown'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'

const RESEND_SECONDS = 60

export interface OtpCodeStepProps {
  email: string
  onVerified: (session: Session) => void
  onChangeEmail: () => void
  type?: EmailOtpType
  submitLabel?: string
  resend?: () => Promise<AuthResult>
}

export function OtpCodeStep({
  email,
  onVerified,
  onChangeEmail,
  type = 'email',
  submitLabel = 'Sign in',
  resend,
}: OtpCodeStepProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const resendingRef = useRef(false)
  const { remaining, restart } = useCountdown({ seconds: RESEND_SECONDS })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || code.length !== CODE_LENGTH) return
    setBusy(true)
    setError('')
    const { session, error: verifyError } = await verifyEmailCode({ email, token: code, type })
    setBusy(false)
    if (verifyError || !session) {
      setError(describeSignInError({ error: verifyError ?? {}, step: 'verify' }))
      return
    }
    onVerified(session)
  }

  async function handleResend() {
    if (remaining > 0 || resendingRef.current) return
    resendingRef.current = true
    setError('')
    setNotice('')
    const { error: resendError } = await (resend ?? (() => requestEmailCode({ email })))()
    resendingRef.current = false
    if (resendError) {
      setError(describeSignInError({ error: resendError, step: 'request' }))
      restart({ seconds: rateLimitWaitSeconds({ error: resendError }) ?? RESEND_SECONDS })
      return
    }
    setCode('')
    setNotice('New code sent. Only the newest code works.')
    restart({ seconds: RESEND_SECONDS })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-2xl bg-lob-cream border border-lob-teal/30 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-lob-teal">
          <Check size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-lob-teal">Check your inbox</p>
          <p className="text-xs text-lob-slate mt-1 leading-snug">
            We sent a 6-digit code to <span className="font-semibold break-all">{email}</span>. If
            you ask for another code, only the newest one works.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="otp-code" className="label">
          Code
        </label>
        <input
          id="otp-code"
          value={code}
          onChange={(e) => {
            setCode(sanitiseCode({ value: e.target.value }))
            setError('')
          }}
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          placeholder="••••••"
          className="input text-center text-2xl tracking-[0.5em] font-bold"
        />
      </div>

      <FormError message={error} />
      {notice && <p className="text-xs text-lob-teal font-medium">{notice}</p>}

      <Button type="submit" disabled={busy || code.length !== CODE_LENGTH} fullWidth>
        {busy ? 'Checking…' : submitLabel}
      </Button>

      <p className="text-xs text-lob-muted text-center">Or tap the link in the email.</p>

      <div className="flex items-center justify-between text-xs">
        <TextButton onClick={handleResend} disabled={remaining > 0}>
          {remaining > 0
            ? `Resend code (in ${formatCountdown({ seconds: remaining })})`
            : 'Resend code'}
        </TextButton>
        <TextButton tone="neutral" onClick={onChangeEmail}>
          Change email
        </TextButton>
      </div>
    </form>
  )
}
