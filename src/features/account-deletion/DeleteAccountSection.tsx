import { useState } from 'react'
import { UserX } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { SettingRow } from '../../components/ui/SettingRow'
import { TextButton } from '../../components/ui/TextButton'
import { deleteMyAccount, type DeleteStatus } from './deletionQueries'
import {
  CODE_REQUIRED_LINE,
  codeIsFresh,
  removePhotoThenDelete,
  type DeletionStep,
} from './deletionFlow'
import { CodeEntry, LastStep, SummaryStep } from './deletionSteps'
import { leaveAfterDeletion } from './leaveDevice'

const ADMIN_LINE =
  "Admins can't delete their own account. Ask Jon to remove your admin role first, then come back here."
const LIVE_EVENT_LINE =
  "You're in an event that's under way. You can delete your account once it's finished."

// What the member sees when the delete doesn't go through. `deleted` and
// `already_deleted` both end on the goodbye screen.
const MESSAGES = {
  refusals: {
    code_required: CODE_REQUIRED_LINE,
    admin_must_step_down: ADMIN_LINE,
    in_live_event: LIVE_EVENT_LINE,
    not_found: "We couldn't find your account. Nothing was deleted.",
  } satisfies Partial<Record<DeleteStatus, string>>,
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
  const cancel = () => restart()

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
          ) : step === 'summary' ? (
            <SummaryStep
              voice="self"
              heading="What happens when you delete your account"
              loadError="Couldn't check what deleting your account would change."
              blockedLine={(summary) =>
                summary.is_admin ? ADMIN_LINE : summary.in_live_event ? LIVE_EVENT_LINE : ''
              }
              noEmailLine="There's no email on your account to send a code to. Ask an admin to delete your account for you."
              email={email}
              notice={notice}
              onSent={() => setStep('code')}
              onCancel={cancel}
            />
          ) : step === 'code' ? (
            <CodeEntry
              email={email}
              help="No email? Check your spam folder or resend the code. If it still doesn't arrive, an admin can delete your account for you."
              onVerified={() => setStep('confirm')}
              onCancel={cancel}
            />
          ) : (
            <ConfirmStep playerId={playerId} onCancel={cancel} onRefused={restart} />
          )}
        </ListRow>
      </ListCard>
    </Section>
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
    if (!codeIsFresh({ session })) return onRefused(CODE_REQUIRED_LINE)
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
    <LastStep
      text="Your account will be deleted now. This can't be undone."
      error={error}
      deleting={deleting}
      onDelete={handleDelete}
      onCancel={onCancel}
    />
  )
}
