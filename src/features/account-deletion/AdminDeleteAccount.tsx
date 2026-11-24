import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UserX } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useConfirmOnBehalf } from '../../lib/confirmOnBehalf'
import { useToast } from '../../lib/toastBus'
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
import { deletionFollowupsKey } from '../home/deletionFollowupQueries'
import { playerKeys } from '../players/playerKeys'
import { adminDeleteAccount, type DeleteStatus } from './deletionQueries'
import {
  codeIsFresh,
  removePhotoThenDelete,
  typedNameMatches,
  useDeletionSummary,
  type DeletionStep,
} from './deletionFlow'
import { CancelRow, CodeEntry, SummaryLines } from './deletionSteps'

interface Target {
  id: string
  name: string
}

const adminLine = ({ name }: Target) =>
  `${name} is an admin, so their account can't be deleted here. Ask Jon to remove the admin role first.`
const liveEventLine = ({ name }: Target) =>
  `${name} is in an event that's under way. Their account can be deleted once it's finished.`

function refusals(target: Target): Partial<Record<DeleteStatus, string>> {
  return {
    code_required: 'Your code is more than 10 minutes old. Ask for a new one to carry on.',
    admin_must_step_down: adminLine(target),
    in_live_event: liveEventLine(target),
    not_found: `${target.name} couldn't be found. Nothing was deleted.`,
    cannot_delete_self: 'You can delete your own account from Account, not here.',
  }
}

/** Player admin page: an admin deletes a member's account (docs/account-deletion DESIGN §3.2). */
export default function AdminDeleteAccount({ player }: { player: Target }) {
  const { session } = useApp()
  const [step, setStep] = useState<DeletionStep>('idle')
  const [notice, setNotice] = useState('')
  const adminEmail = session?.user?.email ?? ''

  const restart = (message = '') => {
    setNotice(message)
    setStep(message ? 'summary' : 'idle')
  }

  return (
    <Section title="Delete account" icon={<UserX />}>
      <ListCard label="Delete account">
        <ListRow>
          {step === 'idle' ? (
            <SettingRow
              label={`${player.name}'s account`}
              value="Wipes their personal info. Their results stay, under an anonymous name."
              action={
                <TextButton tone="destructive" onClick={() => setStep('summary')}>
                  Delete account
                </TextButton>
              }
            />
          ) : step === 'summary' ? (
            <SummaryStep
              player={player}
              adminEmail={adminEmail}
              notice={notice}
              onSent={() => setStep('code')}
              onCancel={() => restart()}
            />
          ) : step === 'code' ? (
            <CodeEntry
              email={adminEmail}
              help="No email? Check your spam folder or resend the code."
              onVerified={() => setStep('confirm')}
              onCancel={() => restart()}
            />
          ) : (
            <ConfirmStep player={player} onCancel={() => restart()} onRefused={restart} />
          )}
        </ListRow>
      </ListCard>
    </Section>
  )
}

function SummaryStep({
  player,
  adminEmail,
  notice,
  onSent,
  onCancel,
}: {
  player: Target
  adminEmail: string
  notice: string
  onSent: () => void
  onCancel: () => void
}) {
  const { data: summary, isPending, isError, refetch } = useDeletionSummary({ targetId: player.id })
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function sendCode() {
    setSending(true)
    setError('')
    const { error: sendError } = await requestEmailCode({ email: adminEmail })
    setSending(false)
    if (sendError) {
      setError(describeSignInError({ error: sendError, step: 'request' }))
      return
    }
    onSent()
  }

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
          Couldn&apos;t check what deleting {player.name}&apos;s account would change.
        </AlertBox>
        <CancelRow onCancel={onCancel} />
      </div>
    )

  const blocked = summary.is_admin
    ? adminLine(player)
    : summary.in_live_event
      ? liveEventLine(player)
      : ''
  return (
    <div className="space-y-3">
      {notice && notice !== blocked && (
        <AlertBox variant="warning" size="sm">
          {notice}
        </AlertBox>
      )}
      <p className="text-sm font-semibold text-lob-dark">
        What happens when you delete {player.name}&apos;s account
      </p>
      <SummaryLines summary={summary} voice="admin" />
      {blocked ? (
        <>
          <AlertBox variant="warning" size="sm">
            {blocked}
          </AlertBox>
          <CancelRow onCancel={onCancel} />
        </>
      ) : (
        <>
          <div>
            <label htmlFor="delete-confirm-name" className="label">
              Type {player.name} to confirm
            </label>
            <input
              id="delete-confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="input"
            />
          </div>
          <p className="caption">
            To make sure it&apos;s you, we&apos;ll email a 6-digit code to your own address,{' '}
            <span className="font-semibold break-all">{adminEmail}</span>.
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
            <Button
              onClick={sendCode}
              disabled={sending || !adminEmail || !typedNameMatches({ typed, name: player.name })}
            >
              {sending ? 'Sending…' : 'Email me a code'}
            </Button>
          </ActionRow>
        </>
      )}
    </div>
  )
}

function ConfirmStep({
  player,
  onCancel,
  onRefused,
}: {
  player: Target
  onCancel: () => void
  onRefused: (message: string) => void
}) {
  const { session } = useApp()
  const confirmOnBehalf = useConfirmOnBehalf()
  const { showToast } = useToast()
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const messages = {
    refusals: refusals(player),
    photoFailed: `Couldn't remove ${player.name}'s photo, so nothing was deleted. Try again.`,
    deleteFailed: `Couldn't delete ${player.name}'s account. Try again.`,
  }

  async function handleDelete() {
    const confirmed = await confirmOnBehalf({
      title: `Delete ${player.name}'s account?`,
      lines: [
        `Player: ${player.name}`,
        "Their personal info is wiped and their results stay under an anonymous name. This can't be undone.",
      ],
      confirmLabel: 'Delete account',
      destructive: true,
    })
    if (!confirmed) return
    // The server would refuse a stale code anyway; checking first keeps the photo.
    if (!codeIsFresh({ session })) return onRefused(messages.refusals.code_required ?? '')
    setDeleting(true)
    setError('')
    let anonymisedName: string | null = null
    const outcome = await removePhotoThenDelete({
      playerId: player.id,
      role: 'admin',
      deleteAccount: async () => {
        const result = await adminDeleteAccount({ targetId: player.id })
        anonymisedName = result.anonymisedName
        return result.status
      },
      messages,
    })
    setDeleting(false)
    if (outcome.done) {
      showToast({
        variant: 'success',
        message: anonymisedName
          ? `${player.name}'s account is deleted. They now show as ${anonymisedName}.`
          : `${player.name}'s account is deleted.`,
      })
      void qc.invalidateQueries({ queryKey: playerKeys.all() })
      void qc.invalidateQueries({ queryKey: deletionFollowupsKey })
      return
    }
    if (outcome.refusal) onRefused(outcome.refusal)
    else setError(outcome.error)
  }

  return (
    <div className="space-y-3">
      <AlertBox variant="error" size="sm" title="Last step">
        {player.name}&apos;s account will be deleted now. This can&apos;t be undone.
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
