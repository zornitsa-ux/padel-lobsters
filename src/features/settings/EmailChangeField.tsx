import { useState, type FormEvent } from 'react'
import { Mail, Check } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { isSyntheticEmail } from '../auth/syntheticEmail'
import { ADD_EMAIL_REQUEST } from '../auth/upgradeCopy'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { AlertBox } from '../../components/ui/AlertBox'
import { Well } from '../../components/ui/Well'

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
          <Button
            variant="secondary"
            onClick={() => {
              setEmailEditing(true)
              setNewEmail('')
              setEmailStatus('')
            }}
          >
            Change
          </Button>
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
            <AlertBox variant="error" size="sm">
              {emailStatus}
            </AlertBox>
          )}
          <ActionRow>
            <Button
              variant="neutral"
              onClick={() => {
                setEmailEditing(false)
                setEmailStatus('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={emailBusy || !newEmail.trim()} icon={<Mail />}>
              {emailBusy ? 'Sending…' : 'Send confirmation'}
            </Button>
          </ActionRow>
          <p className="text-xs text-lob-muted">
            We'll email a confirmation link to the new address. The change only takes effect once
            you click it.
          </p>
        </form>
      )}
      {emailEditing && emailStatus === 'sent' && (
        <div className="space-y-2">
          <Well>
            <p className="flex items-start gap-2 text-xs text-lob-slate leading-snug">
              <Check size={14} className="text-lob-teal mt-0.5 flex-shrink-0" />
              <span>
                Confirmation sent to{' '}
                <span className="font-semibold break-all">{newEmail.trim()}</span>. Click the link
                in that email to finish the change.
              </span>
            </p>
          </Well>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setEmailEditing(false)
              setEmailStatus('')
            }}
          >
            Done
          </Button>
        </div>
      )}
    </>
  )
}
