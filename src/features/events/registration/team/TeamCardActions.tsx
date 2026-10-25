import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import { useConfirm } from '../../../../lib/confirmBus'
import { partnerAcceptNote } from '../../teams/teamStatusMessages'
import { useTeamActions } from '../../teams/useTeams'
import type { TeamEntry } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import ChangePartnerPanel from './ChangePartnerPanel'
import { useConfirmDecline } from './useConfirmDecline'
import { Button } from '../../../../components/ui/Button'
import { TextButton } from '../../../../components/ui/TextButton'

interface ActionsProps {
  entry: TeamEntry
  tournamentId: string
  otherName: string
}

export function CaptainPendingActions({
  entry,
  tournamentId,
  otherName,
  candidates,
  displayName,
}: ActionsProps & { candidates: Player[]; displayName: DisplayName }) {
  const confirm = useConfirm()
  const { cancelMyTeam } = useTeamActions()
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel your team?',
      message: `Your team with ${otherName} will be cancelled and your spots go to the next team on the waitlist.`,
      confirmLabel: 'Cancel team',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    await cancelMyTeam({ tournamentId, teamId: entry.team.id })
    setBusy(false)
  }

  if (changing) {
    return (
      <ChangePartnerPanel
        tournamentId={tournamentId}
        teamId={entry.team.id}
        candidates={candidates}
        displayName={displayName}
        onClose={() => setChanging(false)}
      />
    )
  }
  return (
    <div className="flex gap-4">
      <TextButton onClick={() => setChanging(true)}>Change partner</TextButton>
      <TextButton tone="destructive" onClick={() => void cancel()} disabled={busy}>
        Cancel team
      </TextButton>
    </div>
  )
}

export function PartnerPendingActions({ entry, tournamentId, otherName }: ActionsProps) {
  const confirmDecline = useConfirmDecline()
  const { respondToTeamInvite } = useTeamActions()
  const [busy, setBusy] = useState(false)

  const respond = async ({ accept }: { accept: boolean }) => {
    if (!accept) {
      if (!(await confirmDecline({ captainName: otherName }))) return
    }
    setBusy(true)
    await respondToTeamInvite({ tournamentId, teamId: entry.team.id, accept })
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-lob-muted">{partnerAcceptNote({ captainName: otherName })}</p>
      <div className="flex gap-2">
        <Button
          onClick={() => void respond({ accept: false })}
          disabled={busy}
          variant="secondary"
          size="md"
          className="flex-1"
        >
          I&apos;m not playing
        </Button>
        <Button
          onClick={() => void respond({ accept: true })}
          disabled={busy}
          size="md"
          className="flex-1"
        >
          Accept
        </Button>
      </div>
    </div>
  )
}
