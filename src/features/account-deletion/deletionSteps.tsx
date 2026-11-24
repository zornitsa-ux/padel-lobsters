import { useState, type ReactNode } from 'react'
import { ActionRow } from '../../components/ui/ActionRow'
import { AlertBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { TextButton } from '../../components/ui/TextButton'
import { requestEmailCode } from '../auth/authActions'
import { describeSignInError } from '../auth/authErrors'
import { OtpCodeStep } from '../auth/OtpCodeStep'
import type { DeletionSummary } from './deletionQueries'
import { useDeletionSummary } from './deletionFlow'
import { describeDeletion, type DeletionVoice } from './deletionSummary'

// Pieces shared by a member deleting their own account (DESIGN §3.1) and an
// admin deleting a member's (§3.2).

export function SummaryLines({
  summary,
  voice,
}: {
  summary: DeletionSummary
  voice: DeletionVoice
}) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm text-lob-slate">
      {describeDeletion({ summary, voice }).map((line) => (
        <li key={line.id}>{line.text}</li>
      ))}
    </ul>
  )
}

export function CancelRow({ onCancel }: { onCancel: () => void }) {
  return (
    <ActionRow layout="end">
      <TextButton tone="neutral" onClick={onCancel}>
        Cancel
      </TextButton>
    </ActionRow>
  )
}

/** The emailed code, which signs the caller in again so the server sees a fresh code (C-2). */
export function CodeEntry({
  email,
  help,
  onVerified,
  onCancel,
}: {
  email: string
  help: string
  onVerified: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <OtpCodeStep
        email={email}
        onVerified={onVerified}
        submitLabel="Confirm it's me"
        linkHint={false}
      />
      <p className="caption">{help}</p>
      <CancelRow onCancel={onCancel} />
    </div>
  )
}

interface SummaryStepProps {
  /** The member being deleted by an admin; none for the member's own account. */
  targetId?: string
  voice: DeletionVoice
  heading: string
  loadError: string
  /** Why this account can't be deleted now, or '' when it can. */
  blockedLine: (summary: DeletionSummary) => string
  /** Shown when there's no email to send the code to. */
  noEmailLine: string
  /** Where the code goes: the member's own email, or the admin's. */
  email: string
  /** A refusal that sent the caller back here. */
  notice: string
  /** Extra confirmation before the code (the admin's typed name). */
  children?: ReactNode
  ready?: boolean
  onSent: () => void
  onCancel: () => void
}

/** What deleting changes, then a code to the caller's email (DESIGN §3.1, §3.2). */
export function SummaryStep({
  targetId,
  voice,
  heading,
  loadError,
  blockedLine,
  noEmailLine,
  email,
  notice,
  children,
  ready = true,
  onSent,
  onCancel,
}: SummaryStepProps) {
  const { data: summary, isPending, isError, refetch } = useDeletionSummary({ targetId })

  if (isPending) return <Spinner size="inline" label="Checking the account…" />
  if (isError)
    return (
      <div className="space-y-3">
        <AlertBox
          variant="error"
          size="sm"
          action={
            <TextButton tone="destructive" onClick={() => void refetch()}>
              Try again
            </TextButton>
          }
        >
          {loadError}
        </AlertBox>
        <CancelRow onCancel={onCancel} />
      </div>
    )

  const blocked = blockedLine(summary) || (email ? '' : noEmailLine)
  return (
    <div className="space-y-3">
      {notice && notice !== blocked && (
        <AlertBox variant="warning" size="sm">
          {notice}
        </AlertBox>
      )}
      <p className="text-sm font-semibold text-lob-dark">{heading}</p>
      <SummaryLines summary={summary} voice={voice} />
      {blocked ? (
        <>
          <AlertBox variant="warning" size="sm">
            {blocked}
          </AlertBox>
          <CancelRow onCancel={onCancel} />
        </>
      ) : (
        <SendCode email={email} ready={ready} onSent={onSent} onCancel={onCancel}>
          {children}
        </SendCode>
      )}
    </div>
  )
}

function SendCode({
  email,
  ready,
  children,
  onSent,
  onCancel,
}: {
  email: string
  ready: boolean
  children?: ReactNode
  onSent: () => void
  onCancel: () => void
}) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setSending(true)
    setError('')
    const { error: sendError } = await requestEmailCode({ email })
    setSending(false)
    if (sendError) {
      setError(describeSignInError({ error: sendError, step: 'request' }))
      return
    }
    onSent()
  }

  return (
    <>
      {children}
      <p className="caption">
        To make sure it&apos;s you, we&apos;ll email a 6-digit code to{' '}
        <span className="font-semibold break-all">{email}</span>.
      </p>
      {error && (
        <AlertBox variant="error" size="sm">
          {error}
        </AlertBox>
      )}
      <ActionRow>
        <Button variant="neutral" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={send} disabled={sending || !ready}>
          {sending ? 'Sending…' : 'Email me a code'}
        </Button>
      </ActionRow>
    </>
  )
}

/** The final, irreversible step. */
export function LastStep({
  text,
  error,
  deleting,
  onDelete,
  onCancel,
}: {
  text: string
  error: string
  deleting: boolean
  onDelete: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <AlertBox variant="error" size="sm" title="Last step">
        {text}
      </AlertBox>
      {error && (
        <AlertBox variant="error" size="sm">
          {error}
        </AlertBox>
      )}
      <ActionRow>
        <Button variant="neutral" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete account'}
        </Button>
      </ActionRow>
    </div>
  )
}
