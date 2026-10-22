import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../../context/useApp'
import { useConfirm } from '../../../lib/confirmBus'
import { EmptyState } from '../../../components/ui/EmptyState'
import { formatEventDate } from '../registration/utils'
import { COMPLETE_TEAMS_NOTE } from '../teams/teamStatusMessages'
import { useMyTeamInvites, useTeamActions } from '../teams/useTeams'
import type { TeamInvite } from '../teams/teamTypes'
import { declineMessage } from '../registration/team/TeamCardActions'
import { eventInfoPath } from './inviteRoutes'

export const inviteMessage = ({ invite }: { invite: TeamInvite }) =>
  `${invite.captainName} has entered you as their partner for ${invite.tournamentName} on ${formatEventDate(invite.tournamentDate)}.`

function InviteCard({
  invite,
  busy,
  onAccept,
  onDecline,
}: {
  invite: TeamInvite
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="card space-y-3">
      <p className="font-semibold text-lob-dark">{inviteMessage({ invite })}</p>
      <p className="text-sm text-lob-muted">{COMPLETE_TEAMS_NOTE}</p>
      <div className="flex gap-2">
        <button onClick={onDecline} disabled={busy} className="btn-secondary flex-1 py-2.5 text-sm">
          I&apos;m not playing
        </button>
        <button onClick={onAccept} disabled={busy} className="btn-primary flex-1 py-2.5 text-sm">
          Accept
        </button>
      </div>
    </div>
  )
}

function FinishProfileCard({ invite, onSkip }: { invite: TeamInvite; onSkip: () => void }) {
  return (
    <div className="card space-y-3">
      <p className="font-semibold text-lob-dark">
        You&apos;re in for {invite.tournamentName}. Add a few details to finish your profile?
      </p>
      <div className="flex gap-2">
        <button onClick={onSkip} className="btn-secondary flex-1 py-2.5 text-sm">
          Skip
        </button>
        <Link to="/account" className="btn-primary flex-1 py-2.5 text-sm text-center">
          Finish your profile
        </Link>
      </div>
    </div>
  )
}

export default function TeamInvitesPage() {
  const { session } = useApp()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { respondToTeamInvite } = useTeamActions()
  const { data: invites = [], isPending } = useMyTeamInvites({ enabled: !!session })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string[]>([])
  const [profileFor, setProfileFor] = useState<TeamInvite | null>(null)

  const open = invites.filter((i) => !answered.includes(i.teamId))

  const respond = async ({ invite, accept }: { invite: TeamInvite; accept: boolean }) => {
    if (!accept) {
      const ok = await confirm({
        title: 'Not playing?',
        message: declineMessage({ captainName: invite.captainName }),
        confirmLabel: "I'm not playing",
        destructive: true,
      })
      if (!ok) return
    }
    setBusyId(invite.teamId)
    const status = await respondToTeamInvite({
      tournamentId: invite.tournamentId,
      teamId: invite.teamId,
      accept,
    })
    setBusyId(null)
    if (status !== 'accepted' && status !== 'declined') return
    setAnswered((ids) => [...ids, invite.teamId])
    if (status === 'accepted' && invite.accountCreatedByCaptain) setProfileFor(invite)
    else if (status === 'accepted') navigate(eventInfoPath({ tournamentId: invite.tournamentId }))
  }

  if (profileFor) {
    return (
      <div className="space-y-4">
        <FinishProfileCard
          invite={profileFor}
          onSkip={() => navigate(eventInfoPath({ tournamentId: profileFor.tournamentId }))}
        />
      </div>
    )
  }

  if (isPending) return null

  if (open.length === 0) {
    return (
      <EmptyState
        title="No team invites waiting"
        action={
          <button
            onClick={() => navigate('/events')}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            Go to Events
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-lob-dark">Team invite</h2>
      {open.map((invite) => (
        <InviteCard
          key={invite.teamId}
          invite={invite}
          busy={busyId === invite.teamId}
          onAccept={() => void respond({ invite, accept: true })}
          onDecline={() => void respond({ invite, accept: false })}
        />
      ))}
      <button
        onClick={() => navigate('/home')}
        className="w-full text-sm font-semibold text-lob-muted underline underline-offset-2"
      >
        Not now
      </button>
    </div>
  )
}
