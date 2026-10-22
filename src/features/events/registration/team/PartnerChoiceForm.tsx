import { useState } from 'react'
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

  const isNew = mode === 'new'
  const ready = isNew ? isDraftComplete({ draft }) : selectedId !== ''
  const submit = () =>
    onSubmit({
      choice: isNew ? draftToChoice({ draft }) : { kind: 'member', playerId: selectedId },
    })

  return (
    <div className="space-y-3">
      {isNew ? (
        <>
          <NewPartnerForm draft={draft} onChange={setDraft} />
          <button
            type="button"
            onClick={() => setMode('search')}
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
          />
          <button
            type="button"
            onClick={() => setMode('new')}
            className="text-sm font-semibold text-lob-teal"
          >
            My partner isn&apos;t on Padel Lobsters →
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-600">
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
          disabled={!ready || busy}
          className="btn-primary flex-1 py-2.5 text-sm"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
