import { useState } from 'react'
import { useCheckNewPartnerEmail } from '../../teams/useTeams'
import { PARTNER_ERROR_MESSAGES } from '../../teams/teamStatusMessages'
import type { Player } from '../../../../lib/normalise'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import NewPartnerForm from './NewPartnerForm'
import PlayerPicker from './PlayerPicker'
import { choiceToDraft, draftToChoice, isDraftComplete } from './teamHelpers'
import { Button } from '../../../../components/ui/Button'
import { TextButton } from '../../../../components/ui/TextButton'

interface PartnerChoiceFormProps {
  candidates: Player[]
  displayName: DisplayName
  submitLabel: string
  newPartnerLabel?: string
  initialChoice?: PartnerChoice | null
  busy?: boolean
  error?: string
  onSubmit: (args: { choice: PartnerChoice }) => void
  onCancel: () => void
}

export default function PartnerChoiceForm({
  candidates,
  displayName,
  submitLabel,
  newPartnerLabel = "My partner isn't on Padel Lobsters →",
  initialChoice = null,
  busy = false,
  error = '',
  onSubmit,
  onCancel,
}: PartnerChoiceFormProps) {
  const [mode, setMode] = useState<'search' | 'new'>(
    initialChoice?.kind === 'new' ? 'new' : 'search',
  )
  const [selectedId, setSelectedId] = useState(
    initialChoice?.kind === 'member' ? initialChoice.playerId : '',
  )
  const [draft, setDraft] = useState(() => choiceToDraft({ choice: initialChoice }))
  const [emailProblem, setEmailProblem] = useState<'' | 'invalid_email' | 'email_in_use'>('')
  const [checking, setChecking] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const checkEmail = useCheckNewPartnerEmail()

  const isNew = mode === 'new'
  const ready = isNew ? isDraftComplete({ draft }) && !emailProblem : selectedId !== ''

  const submitNew = async () => {
    setChecking(true)
    const status = await checkEmail({ email: draft.email })
    setChecking(false)
    if (status !== 'ok') {
      setEmailProblem(status)
      return
    }
    onSubmit({ choice: draftToChoice({ draft }) })
  }
  const submit = () => {
    if (isNew) void submitNew()
    else onSubmit({ choice: { kind: 'member', playerId: selectedId } })
  }
  const searchMembers = ({ search }: { search: string }) => {
    setMemberSearch(search)
    setEmailProblem('')
    setMode('search')
  }
  const emailError = emailProblem && (
    <span role="alert" className="block mt-1 font-normal text-lob-danger">
      {PARTNER_ERROR_MESSAGES[emailProblem]}
      {emailProblem === 'email_in_use' && (
        <TextButton
          size="inherit"
          className="block mt-1"
          onClick={() => searchMembers({ search: draft.name })}
        >
          Search members
        </TextButton>
      )}
    </span>
  )

  return (
    <div className="space-y-3">
      {isNew ? (
        <>
          <NewPartnerForm
            draft={draft}
            onChange={(next) => {
              if (next.email !== draft.email) setEmailProblem('')
              setDraft(next)
            }}
            emailError={emailError}
          />
          <TextButton onClick={() => searchMembers({ search: '' })}>
            ← Search members instead
          </TextButton>
        </>
      ) : (
        <>
          <PlayerPicker
            players={candidates}
            selectedId={selectedId}
            onSelect={setSelectedId}
            displayName={displayName}
            initialSearch={memberSearch}
          />
          <TextButton size="sm" onClick={() => setMode('new')}>
            {newPartnerLabel}
          </TextButton>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-lob-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="secondary" className="flex-1">
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || busy || checking} className="flex-1">
          {busy ? 'Saving…' : checking ? 'Checking…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
