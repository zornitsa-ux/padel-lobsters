import { useState, type FormEvent } from 'react'
import { requestReauthentication, setPassword } from './authActions'
import { FormError } from './FormError'
import { describePasswordError, PASSWORD_RULES_COPY } from './passwordErrors'

export interface PasswordFormProps {
  requireCurrentPassword: boolean
  submitLabel: string
  onDone: () => void
}

export function PasswordForm({ requireCurrentPassword, submitLabel, onDone }: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setNewPassword] = useState('')
  const [nonce, setNonce] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode() {
    const { error: reauthError } = await requestReauthentication()
    if (reauthError) {
      setError(describePasswordError({ error: reauthError }))
      return
    }
    setNeedsCode(true)
    setNotice("We emailed you a code to confirm it's you. Enter it below.")
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const { error: updateError } = await setPassword({ password, currentPassword, nonce })
    if (!updateError) {
      setBusy(false)
      onDone()
      return
    }
    if (updateError.code === 'reauthentication_needed') await sendCode()
    else setError(describePasswordError({ error: updateError }))
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {requireCurrentPassword && (
        <div>
          <label htmlFor="current-password" className="label">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
          />
        </div>
      )}
      <div>
        <label htmlFor="new-password" className="label">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-describedby="password-rules"
          className="input"
        />
        <p id="password-rules" className="text-xs text-lob-muted-light mt-1">
          {PASSWORD_RULES_COPY}
        </p>
      </div>
      {needsCode && (
        <div>
          <label htmlFor="reauth-code" className="label">
            Code from your email
          </label>
          <input
            id="reauth-code"
            value={nonce}
            onChange={(e) => setNonce(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            className="input"
          />
          <button
            type="button"
            onClick={sendCode}
            className="text-xs font-semibold text-lob-teal mt-1"
          >
            Send a new code
          </button>
        </div>
      )}
      {notice && <p className="text-xs text-lob-teal font-medium">{notice}</p>}
      <FormError message={error} />
      <button
        type="submit"
        disabled={busy || !password || (needsCode && nonce.length !== 6)}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
