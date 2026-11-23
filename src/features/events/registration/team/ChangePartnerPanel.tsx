import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import { CHANGE_PARTNER_MESSAGES, teamStatusMessage } from '../../teams/teamStatusMessages'
import { useTeamActions } from '../../teams/useTeams'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { DisplayName, GetPlayer } from '../utils'
import { useConfirmOnBehalf } from '../../../../lib/confirmOnBehalf'
import PartnerChoiceForm from './PartnerChoiceForm'
import { choicePartnerName, partnerConfirmLine } from './teamHelpers'
import { levelConfirmLine } from '../levelHelpers'
import { useSaveLevels } from '../useSaveLevels'
import { useAdminLevelCheck } from '../../../levelling/useAdminLevelCheck'

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
  const needsLevel = useAdminLevelCheck()
  const saveLevels = useSaveLevels()
  const getPlayer: GetPlayer = (id) => candidates.find((p) => p.id === id)

  const submit = async ({
    choice,
    memberLevel = '',
  }: {
    choice: PartnerChoice
    memberLevel?: string
  }) => {
    if (onBehalfOf !== undefined) {
      // Set when the form asked for the picked member's level (S6b).
      const levelFor =
        memberLevel && choice.kind === 'member' ? getPlayer(choice.playerId) : undefined
      const ok = await confirmOnBehalf({
        title: 'Change partner?',
        lines: [
          `Team: ${onBehalfOf}`,
          partnerConfirmLine({ label: 'New partner', choice, getPlayer, displayName }),
          ...(levelFor ? [levelConfirmLine({ label: "Partner's level", level: memberLevel })] : []),
        ],
        confirmLabel: 'Change partner',
      })
      if (!ok) return
      const saved =
        !levelFor ||
        (await saveLevels({
          levels: [{ playerId: levelFor.id, name: displayName(levelFor), level: memberLevel }],
        }))
      if (!saved) return
    }
    setBusy(true)
    setError('')
    const { status } = await changeTeamPartner({ tournamentId, teamId, choice })
    setBusy(false)
    if (status === 'changed') onClose()
    else
      setError(
        teamStatusMessage({
          map: CHANGE_PARTNER_MESSAGES,
          status,
          partnerName: choicePartnerName({ choice, getPlayer }),
        }),
      )
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
        memberNeedsLevel={onBehalfOf !== undefined ? needsLevel : undefined}
        onSubmit={(args) => void submit(args)}
        onCancel={onClose}
      />
    </div>
  )
}
