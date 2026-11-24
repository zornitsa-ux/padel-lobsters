import { useState } from 'react'
import { UserX } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { ActionRow } from '../../components/ui/ActionRow'
import { AlertBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { SettingRow } from '../../components/ui/SettingRow'
import { Spinner } from '../../components/ui/Spinner'
import { TextButton } from '../../components/ui/TextButton'
import { requestEmailCode } from '../auth/authActions'
import { describeSignInError } from '../auth/authErrors'
import { deleteMyAccount, type DeleteStatus } from './deletionQueries'
import {
  codeIsFresh,
  removePhotoThenDelete,
  useDeletionSummary,
  type DeletionStep,
} from './deletionFlow'
import { CancelRow, CodeEntry, SummaryLines } from './deletionSteps'
import { leaveAfterDeletion } from './leaveDevice'

const ADMIN_LINE =
  "Admins can't delete their own account. Ask Jon to remove your admin role first, then come back here."
const LIVE_EVENT_LINE =
  "You're in an event that's under way. You can delete your account once it's finished."

// What the member sees when the delete doesn't go through. `deleted` and
// `already_deleted` both end on the goodbye screen.
const REFUSALS: Partial<Record<DeleteStatus, string>> = {
  code_required: 'Your code is more than 10 minutes old. Ask for a new one to carry on.',
  admin_must_step_down: ADMIN_LINE,
  in_live_event: LIVE_EVENT_LINE,
  not_found: "We couldn't find your account. Nothing was deleted.",
}

const MESSAGES = {
  refusals: REFUSALS,
  photoFailed: "Couldn't remove your photo, so nothing was deleted. Try again.",
  deleteFailed: "Couldn't delete your account. You're still signed in, so try again.",
}

/** Settings: a member deletes their own account (docs/account-deletion DESIGN §3.1). */
export default function DeleteAccountSection() {
  const { session, isAdmin } = useApp()
  const [step, setStep] = useState<DeletionStep>('idle')
  const [notice, setNotice] = useState('')
  const playerId = session?.user?.id
  const email = session?.user?.email ?? ''
  if (!playerId) return null

  const restart = (message = '') => {
    setNotice(message)
    setStep(message ? 'summary' : 'idle')
  }

  return (
    <Section title="Delete account" icon={<UserX />}>
      <ListCard label="Delete account">
        <ListRow>
          {isAdmin ? (
            <SettingRow label="Your account" value={ADMIN_LINE} />
          ) : step === 'idle' ? (
            <SettingRow
              label="Your account"
              value="Deletes your profile and personal info. Your results stay, under an anonymous name."
              action={
                <TextButton tone="destructive" onClick={() => setStep('summary')}>
                  Delete my account
                </TextButton>
              }
            />
          ) : (
            <DeleteFlow
              step={step}
              setStep={setStep}
              email={email}
              playerId={playerId}
              notice={notice}
              onCancel={() => restart()}
              onRefused={restart}
            />
          )}
        </ListRow>
      </ListCard>
    </Section>
  )
}

interface DeleteFlowProps {
  step: Exclude<DeletionStep, 'idle'>
  setStep: (step: DeletionStep) => void
  email: string
  playerId: string
  notice: string
  onCancel: () => void
  onRefused: (message: string) => void
}

function DeleteFlow({
  step,
  setStep,
  email,
  playerId,
  notice,
  onCancel,
  onRefused,
}: DeleteFlowProps) {
  if (step === 'summary')
    return (
      <SummaryStep
        email={email}
        notice={notice}
        onSent={() => setStep('code')}
        onCancel={onCancel}
      />
    )
  if (step === 'code')
    return (
      <CodeEntry
        email={email}
        help="No email? Check your spam folder or resend the code. If it still doesn't arrive, an admin can delete your account for you."
        onVerified={() => setStep('confirm')}
        onCancel={onCancel}
      />
    )
  return <ConfirmStep playerId={playerId} onCancel={onCancel} onRefused={onRefused} />
}

function SummaryStep({
  email,
  notice,
  onSent,
  onCancel,
}: {
  email: string
  notice: string
  onSent: () => void
  onCancel: () => void
}) {
  const { data: summary, isPending, isError, refetch } = useDeletionSummary({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function sendCode() {
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

  if (isPending) return <Spinner size="inline" label="Checking your account…" />
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
          Couldn&apos;t check what deleting your account would change.
        </AlertBox>
        <CancelRow onCancel={onCancel} />
      </div>
    )

  const blocked = summary.is_admin ? ADMIN_LINE : summary.in_live_event ? LIVE_EVENT_LINE : ''
  return (
    <div className="space-y-3">
      {notice && notice !== blocked && (
        <AlertBox variant="warning" size="sm">
          {notice}
        </AlertBox>
      )}
      <p className="text-sm font-semibold text-lob-dark">
        What happens when you delete your account
      </p>
      <SummaryLines summary={summary} voice="self" />
      {blocked ? (
        <>
          <AlertBox variant="warning" size="sm">
            {blocked}
          </AlertBox>
          <CancelRow onCancel={onCancel} />
        </>
      ) : !email ? (
        <>
          <AlertBox variant="warning" size="sm">
            There&apos;s no email on your account to send a code to. Ask an admin to delete your
            account for you.
          </AlertBox>
          <CancelRow onCancel={onCancel} />
        </>
      ) : (
        <>
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
            <Button onClick={sendCode} disabled={sending}>
              {sending ? 'Sending…' : 'Email me a code'}
            </Button>
          </ActionRow>
        </>
      )}
    </div>
  )
}

function ConfirmStep({
  playerId,
  onCancel,
  onRefused,
}: {
  playerId: string
  onCancel: () => void
  onRefused: (message: string) => void
}) {
  const { session } = useApp()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    // The server would refuse a stale code anyway; checking first keeps the photo.
    if (!codeIsFresh({ session })) {
      onRefused(REFUSALS.code_required ?? '')
      return
    }
    setDeleting(true)
    setError('')
    const outcome = await removePhotoThenDelete({
      playerId,
      role: 'player',
      deleteAccount: deleteMyAccount,
      messages: MESSAGES,
    })
    if (outcome.done) return leaveAfterDeletion({ playerId })
    setDeleting(false)
    if (outcome.refusal) onRefused(outcome.refusal)
    else setError(outcome.error)
  }

  return (
    <div className="space-y-3">
      <AlertBox variant="error" size="sm" title="Last step">
        Your account will be deleted now. This can&apos;t be undone.
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
        <Button variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete account'}
        </Button>
      </ActionRow>
    </div>
  )
}
