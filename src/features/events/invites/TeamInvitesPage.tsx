import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { useApp } from '../../../context/useApp'
import { useConfirm } from '../../../lib/confirmBus'
import { EmptyState } from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import DateTile from '../../../components/ui/DateTile'
import { usePlayers } from '../../players/usePlayers'
import { partnerAcceptNote } from '../teams/teamStatusMessages'
import { useMyTeamInvites, useTeamActions } from '../teams/useTeams'
import type { TeamInvite } from '../teams/teamTypes'
import { declineMessage } from '../registration/team/teamHelpers'
import { eventInfoPath, inviteReturnPath, inviteWhen } from './inviteRoutes'

function EventHeading({ invite, eyebrow }: { invite: TeamInvite; eyebrow: string }) {
  return (
    <div className="flex items-center gap-4">
      <DateTile date={invite.tournamentDate} />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-lob-teal">{eyebrow}</p>
        <h2 className="text-lg font-bold text-lob-dark leading-snug">{invite.tournamentName}</h2>
        <p className="text-sm text-lob-muted">{inviteWhen({ invite })}</p>
      </div>
    </div>
  )
}

function InviteCard({
  invite,
  captainAvatarUrl,
  busy,
  onAccept,
  onDecline,
}: {
  invite: TeamInvite
  captainAvatarUrl: string | null
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="card space-y-5">
      <EventHeading invite={invite} eyebrow="Team invite" />
      <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
        <Avatar player={{ name: invite.captainName, avatarUrl: captainAvatarUrl }} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold text-lob-dark">{invite.captainName}</p>
          <p className="text-sm text-lob-muted">has entered you as their partner</p>
        </div>
      </div>
      <p className="text-sm text-lob-slate leading-relaxed">
        {partnerAcceptNote({ captainName: invite.captainName })}
      </p>
      <div className="space-y-2">
        <button onClick={onAccept} disabled={busy} className="btn-primary w-full py-3">
          Accept
        </button>
        <button onClick={onDecline} disabled={busy} className="btn-secondary w-full py-3">
          I&apos;m not playing
        </button>
      </div>
    </div>
  )
}

function FinishProfileCard({ invite, onSkip }: { invite: TeamInvite; onSkip: () => void }) {
  return (
    <div className="card space-y-5">
      <EventHeading invite={invite} eyebrow="You're in" />
      <div className="flex items-start gap-3 rounded-xl bg-green-50 px-4 py-3">
        <CheckCircle size={20} className="mt-0.5 flex-shrink-0 text-green-600" />
        <p className="text-sm text-lob-slate leading-relaxed">
          Your team with {invite.captainName} is confirmed. Add a few details to finish your
          profile?
        </p>
      </div>
      <div className="space-y-2">
        <Link to="/account" className="btn-primary block w-full py-3 text-center">
          Finish your profile
        </Link>
        <button onClick={onSkip} className="btn-secondary w-full py-3">
          Skip
        </button>
      </div>
    </div>
  )
}

export default function TeamInvitesPage() {
  const { session } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const { respondToTeamInvite } = useTeamActions()
  const { data: invites = [], isPending } = useMyTeamInvites({ enabled: !!session })
  const { data: players = [] } = usePlayers()
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
      <div className="pt-5">
        <FinishProfileCard
          invite={profileFor}
          onSkip={() => navigate(eventInfoPath({ tournamentId: profileFor.tournamentId }))}
        />
      </div>
    )
  }

  if (!session) {
    return (
      <EmptyState
        title="Sign in to see your team invites"
        action={
          <button
            onClick={() => navigate('/account')}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            Sign in
          </button>
        }
      />
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
    <div className="pt-5 space-y-4">
      {open.map((invite) => (
        <InviteCard
          key={invite.teamId}
          invite={invite}
          captainAvatarUrl={players.find((p) => p.id === invite.captainId)?.avatarUrl || null}
          busy={busyId === invite.teamId}
          onAccept={() => void respond({ invite, accept: true })}
          onDecline={() => void respond({ invite, accept: false })}
        />
      ))}
      <button
        onClick={() => navigate(inviteReturnPath({ state: location.state }))}
        className="block mx-auto px-4 py-2 text-sm font-semibold text-lob-muted"
      >
        Not now
      </button>
    </div>
  )
}
