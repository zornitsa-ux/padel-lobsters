import { useState } from 'react'
import { useCheckNewPartnerEmail } from '../../teams/useTeams'
import { PARTNER_ERROR_MESSAGES } from '../../teams/teamStatusMessages'
import type { Player } from '../../../../lib/normalise'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import NewPartnerForm from './NewPartnerForm'
import PlayerPicker from './PlayerPicker'
import { choiceToDraft, draftToChoice, isDraftComplete } from './teamHelpers'

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
        <button
          type="button"
          onClick={() => searchMembers({ search: draft.name })}
          className="block mt-1 font-semibold text-lob-teal underline underline-offset-2"
        >
          Search members
        </button>
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
          <button
            type="button"
            onClick={() => searchMembers({ search: '' })}
            className="text-xs font-semibold text-lob-teal underline underline-offset-2"
          >
            ← Search members instead
          </button>
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
          <button
            type="button"
            onClick={() => setMode('new')}
            className="text-sm font-semibold text-lob-teal"
          >
            {newPartnerLabel}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-lob-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2.5 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy || checking}
          className="btn-primary flex-1 py-2.5 text-sm"
        >
          {busy ? 'Saving…' : checking ? 'Checking…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
