import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import { registrationMessage } from '../../registrationStatusMessages'
import { CHANGE_PARTNER_MESSAGES } from '../../teams/teamStatusMessages'
import { useTeamActions } from '../../teams/useTeams'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import { useConfirmOnBehalf } from '../../../../lib/confirmOnBehalf'
import PartnerChoiceForm from './PartnerChoiceForm'
import { partnerConfirmLine } from './teamHelpers'

interface ChangePartnerPanelProps {
  tournamentId: string
  teamId: string
  candidates: Player[]
  /** Set when an admin changes a team's partner: the team's label for the confirmation. */
  onBehalfOf?: string
  displayName: DisplayName
  onClose: () => void
}

export default function ChangePartnerPanel({
  tournamentId,
  teamId,
  candidates,
  onBehalfOf,
  displayName,
  onClose,
}: ChangePartnerPanelProps) {
  const { changeTeamPartner } = useTeamActions()
  const confirmOnBehalf = useConfirmOnBehalf()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async ({ choice }: { choice: PartnerChoice }) => {
    if (onBehalfOf !== undefined) {
      const ok = await confirmOnBehalf({
        title: 'Change partner?',
        lines: [
          `Team: ${onBehalfOf}`,
          partnerConfirmLine({
            label: 'New partner',
            choice,
            getPlayer: (id) => candidates.find((p) => p.id === id),
            displayName,
          }),
        ],
        confirmLabel: 'Change partner',
      })
      if (!ok) return
    }
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
