import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UserX } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useConfirmOnBehalf } from '../../lib/confirmOnBehalf'
import { useToast } from '../../lib/toastBus'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { SettingRow } from '../../components/ui/SettingRow'
import { TextButton } from '../../components/ui/TextButton'
import { deletionFollowupsKey } from '../home/deletionFollowupQueries'
import { playerKeys } from '../players/playerKeys'
import { adminDeleteAccount, type DeleteStatus } from './deletionQueries'
import {
  CODE_REQUIRED_LINE,
  codeIsFresh,
  removePhotoThenDelete,
  typedNameMatches,
  type DeletionStep,
} from './deletionFlow'
import { CodeEntry, LastStep, SummaryStep } from './deletionSteps'

interface Target {
  id: string
  name: string
}

const adminLine = ({ name }: Target) =>
  `${name} is an admin, so their account can't be deleted here. Ask Jon to remove the admin role first.`
const liveEventLine = ({ name }: Target) =>
  `${name} is in an event that's under way. Their account can be deleted once it's finished.`

function messagesFor(target: Target) {
  return {
    refusals: {
      code_required: CODE_REQUIRED_LINE,
      admin_must_step_down: adminLine(target),
      in_live_event: liveEventLine(target),
      not_found: `${target.name} couldn't be found. Nothing was deleted.`,
      cannot_delete_self: 'You can delete your own account from Account, not here.',
    } satisfies Partial<Record<DeleteStatus, string>>,
    photoFailed: `Couldn't remove ${target.name}'s photo, so nothing was deleted. Try again.`,
    deleteFailed: `Couldn't delete ${target.name}'s account. Try again.`,
  }
}

/** Player admin page: an admin deletes a member's account (docs/account-deletion DESIGN §3.2). */
export default function AdminDeleteAccount({ player }: { player: Target }) {
  const { session } = useApp()
  const [step, setStep] = useState<DeletionStep | 'done'>('idle')
  const [notice, setNotice] = useState('')
  const [typed, setTyped] = useState('')
  const adminEmail = session?.user?.email ?? ''
  // The page turns into the deleted view once the roster refetches.
  if (step === 'done') return null

  const restart = (message = '') => {
    setNotice(message)
    setTyped('')
    setStep(message ? 'summary' : 'idle')
  }
  const cancel = () => restart()

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
              targetId={player.id}
              voice="admin"
              heading={`What happens when you delete ${player.name}'s account`}
              loadError={`Couldn't check what deleting ${player.name}'s account would change.`}
              blockedLine={(summary) =>
                summary.is_admin
                  ? adminLine(player)
                  : summary.in_live_event
                    ? liveEventLine(player)
                    : ''
              }
              noEmailLine="There's no email on your own account to send a code to."
              email={adminEmail}
              notice={notice}
              ready={typedNameMatches({ typed, name: player.name })}
              onSent={() => setStep('code')}
              onCancel={cancel}
            >
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
            </SummaryStep>
          ) : step === 'code' ? (
            <CodeEntry
              email={adminEmail}
              help="No email? Check your spam folder or resend the code."
              onVerified={() => setStep('confirm')}
              onCancel={cancel}
            />
          ) : (
            <ConfirmStep
              player={player}
              onCancel={cancel}
              onRefused={restart}
              onDone={() => setStep('done')}
            />
          )}
        </ListRow>
      </ListCard>
    </Section>
  )
}

function ConfirmStep({
  player,
  onCancel,
  onRefused,
  onDone,
}: {
  player: Target
  onCancel: () => void
  onRefused: (message: string) => void
  onDone: () => void
}) {
  const { session } = useApp()
  const confirmOnBehalf = useConfirmOnBehalf()
  const { showToast } = useToast()
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    // The server would refuse a stale code anyway; checking first keeps the photo
    // and spares the admin a confirmation that can't go through.
    if (!codeIsFresh({ session })) return onRefused(CODE_REQUIRED_LINE)
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
      messages: messagesFor(player),
    })
    setDeleting(false)
    if (!outcome.done) return outcome.refusal ? onRefused(outcome.refusal) : setError(outcome.error)
    showToast({
      variant: 'success',
      message: anonymisedName
        ? `${player.name}'s account is deleted. They now show as ${anonymisedName}.`
        : `${player.name}'s account is deleted.`,
    })
    void qc.invalidateQueries({ queryKey: playerKeys.all() })
    void qc.invalidateQueries({ queryKey: deletionFollowupsKey })
    onDone()
  }

  return (
    <LastStep
      text={`${player.name}'s account will be deleted now. This can't be undone.`}
      error={error}
      deleting={deleting}
      onDelete={handleDelete}
      onCancel={onCancel}
    />
  )
}
