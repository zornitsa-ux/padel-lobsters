import { useState, type FormEvent } from 'react'
import { Mail, Check } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { isSyntheticEmail } from '../auth/syntheticEmail'
import { ADD_EMAIL_REQUEST } from '../auth/upgradeCopy'

// Self-service email change: type new email -> requestMyEmailChange -> Supabase
// emails a confirmation link to the new (and old, since double_confirm_changes
// is on) address -> on click, auth.users.email updates -> the
// sync_auth_email_to_player trigger mirrors it back to players.email. We never
// write players.email directly from the client.
export function EmailChangeField({ email }: { email: string }) {
  if (isSyntheticEmail(email)) return <MissingEmailNotice />
  return <EmailChangeForm email={email} />
}

// A synthetic address never receives mail, so double_confirm_changes can't
// complete a self-service change; an admin sets the email instead.
function MissingEmailNotice() {
  return (
    <p className="text-sm text-lob-slate leading-snug">
      Your account has no email yet. {ADD_EMAIL_REQUEST}
    </p>
  )
}

function EmailChangeForm({ email }: { email: string }) {
  const { requestMyEmailChange } = useApp()
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState('') // '' | 'sent' | error string
  const submitEmailChange = async (e: FormEvent) => {
    e?.preventDefault?.()
    if (emailBusy) return
    setEmailBusy(true)
    setEmailStatus('')
    const result = await requestMyEmailChange(newEmail)
    setEmailBusy(false)
    if (result === 'sent') {
      setEmailStatus('sent')
      return
    }
    if (result === 'invalid')
      return setEmailStatus('That email looks off — double-check the format.')
    if (result === 'taken')
      return setEmailStatus('That email is already on another Lobster account.')
    setEmailStatus('Something went wrong. Try again in a moment.')
  }

  return (
    <>
      {!emailEditing && (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-lob-well border border-lob-line-strong text-sm text-lob-slate truncate">
            {email || <span className="text-lob-muted-light">No email on file</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              setEmailEditing(true)
              setNewEmail('')
              setEmailStatus('')
            }}
            className="text-xs font-semibold text-lob-teal bg-lob-cream border border-lob-teal/30 px-3 py-2 rounded-xl active:scale-95"
          >
            Change
          </button>
        </div>
      )}
      {emailEditing && emailStatus !== 'sent' && (
        <form onSubmit={submitEmailChange} className="space-y-2">
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            className="input"
            placeholder="you@example.com"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value)
              setEmailStatus('')
            }}
            autoFocus
          />
          {emailStatus && emailStatus !== 'sent' && (
            <p className="text-xs text-lob-danger bg-lob-danger-light rounded-lg p-2">
              {emailStatus}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEmailEditing(false)
                setEmailStatus('')
              }}
              className="flex-1 text-sm font-semibold text-lob-slate bg-gray-100 py-2 rounded-xl active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={emailBusy || !newEmail.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Mail size={13} />
              {emailBusy ? 'Sending…' : 'Send confirmation'}
            </button>
          </div>
          <p className="text-xs text-lob-muted">
            We'll email a confirmation link to the new address. The change only takes effect once
            you click it.
          </p>
        </form>
      )}
      {emailEditing && emailStatus === 'sent' && (
        <div className="space-y-2">
          <div className="rounded-xl bg-lob-cream border border-lob-teal/30 p-3 flex items-start gap-2">
            <Check size={14} className="text-lob-teal mt-0.5 flex-shrink-0" />
            <p className="text-xs text-lob-slate leading-snug">
              Confirmation sent to{' '}
              <span className="font-semibold break-all">{newEmail.trim()}</span>. Click the link in
              that email to finish the change.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmailEditing(false)
              setEmailStatus('')
            }}
            className="w-full text-sm font-semibold text-lob-teal py-2 rounded-xl bg-white border border-lob-teal/30"
          >
            Done
          </button>
        </div>
      )}
    </>
  )
}
