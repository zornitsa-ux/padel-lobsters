import { useState } from 'react'
import { useCheckNewPartnerEmail } from '../../teams/useTeams'
import { PARTNER_ERROR_MESSAGES } from '../../teams/teamStatusMessages'
import type { Player } from '../../../../lib/normalise'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import NewPartnerForm from './NewPartnerForm'
import PlayerPicker from '../PlayerPicker'
import { NoLevelField } from '../LevelField'
import { isLevelGiven } from '../levelHelpers'
import { choiceToDraft, draftToChoice, isDraftComplete } from './teamHelpers'
import { ActionRow } from '../../../../components/ui/ActionRow'
import { Button } from '../../../../components/ui/Button'
import { TextButton } from '../../../../components/ui/TextButton'
import { AlertBox } from '../../../../components/ui/AlertBox'

interface PartnerChoiceFormProps {
  candidates: Player[]
  displayName: DisplayName
  submitLabel: string
  newPartnerLabel?: string
  initialChoice?: PartnerChoice | null
  busy?: boolean
  error?: string
  /** Admin forms: a picked member with no level must be given one (S6b). */
  memberNeedsLevel?: (args: { player: Player | undefined }) => boolean
  onSubmit: (args: { choice: PartnerChoice; memberLevel?: string }) => void
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
  memberNeedsLevel,
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
  const [memberLevel, setMemberLevel] = useState('')
  const checkEmail = useCheckNewPartnerEmail()

  const isNew = mode === 'new'
  const picked = candidates.find((p) => p.id === selectedId)
  const levelAsked = !!picked && !!memberNeedsLevel?.({ player: picked })
  const ready = isNew
    ? isDraftComplete({ draft }) && !emailProblem
    : selectedId !== '' && (!levelAsked || isLevelGiven({ level: memberLevel }))
  const pickMember = (id: string) => {
    setSelectedId(id)
    setMemberLevel('')
  }

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
    else
      onSubmit({
        choice: { kind: 'member', playerId: selectedId },
        ...(levelAsked ? { memberLevel } : {}),
      })
  }
  const searchMembers = ({ search }: { search: string }) => {
    setMemberSearch(search)
    setEmailProblem('')
    setMode('search')
  }
  const searchMembersAction = emailProblem === 'email_in_use' && (
    <TextButton size="inherit" onClick={() => searchMembers({ search: draft.name })}>
      Search members
    </TextButton>
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
            emailError={emailProblem && PARTNER_ERROR_MESSAGES[emailProblem]}
            emailErrorAction={searchMembersAction}
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
            onSelect={pickMember}
            displayName={displayName}
            initialSearch={memberSearch}
          />
          {picked && levelAsked && (
            <NoLevelField
              name={displayName(picked)}
              value={memberLevel}
              onChange={setMemberLevel}
            />
          )}
          <TextButton size="sm" onClick={() => setMode('new')}>
            {newPartnerLabel}
          </TextButton>
        </>
      )}
      {error && (
        <AlertBox variant="error" size="sm">
          {error}
        </AlertBox>
      )}
      <ActionRow>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || busy || checking}>
          {busy ? 'Saving…' : checking ? 'Checking…' : submitLabel}
        </Button>
      </ActionRow>
    </div>
  )
}
