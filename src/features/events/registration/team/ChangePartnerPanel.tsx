import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import { registrationMessage } from '../../registrationStatusMessages'
import { CHANGE_PARTNER_MESSAGES } from '../../teams/teamStatusMessages'
import { useTeamActions } from '../../teams/useTeams'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import PartnerChoiceForm from './PartnerChoiceForm'

interface ChangePartnerPanelProps {
  tournamentId: string
  teamId: string
  candidates: Player[]
  displayName: DisplayName
  onClose: () => void
}

export default function ChangePartnerPanel({
  tournamentId,
  teamId,
  candidates,
  displayName,
  onClose,
}: ChangePartnerPanelProps) {
  const { changeTeamPartner } = useTeamActions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async ({ choice }: { choice: PartnerChoice }) => {
    setBusy(true)
    setError('')
    const { status } = await changeTeamPartner({ tournamentId, teamId, choice })
    setBusy(false)
    if (status === 'changed') onClose()
    else setError(registrationMessage({ map: CHANGE_PARTNER_MESSAGES, status }))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-lob-slate">Change partner</p>
      <PartnerChoiceForm
        candidates={candidates}
        displayName={displayName}
        submitLabel="Change partner"
        busy={busy}
        error={error}
        onSubmit={(args) => void submit(args)}
        onCancel={onClose}
      />
    </div>
  )
}
