import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import { useConfirm } from '../../../../lib/confirmBus'
import { partnerAcceptNote } from '../../teams/teamStatusMessages'
import { useTeamActions } from '../../teams/useTeams'
import type { TeamEntry } from '../../teams/teamTypes'
import type { DisplayName } from '../utils'
import ChangePartnerPanel from './ChangePartnerPanel'
import { useConfirmDecline } from './useConfirmDecline'

const LINK = 'text-xs font-semibold text-lob-teal underline underline-offset-2'

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
      <button onClick={() => setChanging(true)} className={LINK}>
        Change partner
      </button>
      <button
        onClick={() => void cancel()}
        disabled={busy}
        className="text-xs font-semibold text-red-600 underline underline-offset-2"
      >
        Cancel team
      </button>
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
        <button
          onClick={() => void respond({ accept: false })}
          disabled={busy}
          className="btn-secondary flex-1 py-2 text-sm"
        >
          I&apos;m not playing
        </button>
        <button
          onClick={() => void respond({ accept: true })}
          disabled={busy}
          className="btn-primary flex-1 py-2 text-sm"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
