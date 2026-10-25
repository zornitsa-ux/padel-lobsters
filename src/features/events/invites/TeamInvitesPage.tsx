import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../../context/useApp'
import { EmptyState } from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import DateTile from '../../../components/ui/DateTile'
import { usePlayers } from '../../players/usePlayers'
import { partnerAcceptNote } from '../teams/teamStatusMessages'
import { useMyAccountSetup, useMyTeamInvites, useTeamActions } from '../teams/useTeams'
import { writeStorage } from '../../../lib/safeStorage'
import type { TeamInvite } from '../teams/teamTypes'
import { useConfirmDecline } from '../registration/team/useConfirmDecline'
import {
  eventInfoPath,
  FINISH_ACCOUNT_PATH,
  inviteReturnPath,
  inviteSeenKey,
  inviteWhen,
} from './inviteRoutes'
import { Button } from '../../../components/ui/Button'

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
      <div className="flex items-center gap-3 rounded-xl bg-lob-well px-4 py-3">
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
        <Button onClick={onAccept} disabled={busy} className="w-full">
          Accept
        </Button>
        <Button onClick={onDecline} disabled={busy} variant="secondary" className="w-full">
          I&apos;m not playing
        </Button>
      </div>
    </div>
  )
}

export default function TeamInvitesPage() {
  const { session } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const confirmDecline = useConfirmDecline()
  const { respondToTeamInvite } = useTeamActions()
  const playerId = session?.user?.id ?? null
  const { data: invites = [], isPending } = useMyTeamInvites({ enabled: !!session })
  const { data: setup } = useMyAccountSetup({ enabled: !!session })
  const { data: players = [] } = usePlayers()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string[]>([])

  useEffect(() => {
    if (playerId) writeStorage({ area: 'session', key: inviteSeenKey({ playerId }), value: '1' })
  }, [playerId])

  const open = invites.filter((i) => !answered.includes(i.teamId))

  const respond = async ({ invite, accept }: { invite: TeamInvite; accept: boolean }) => {
    if (!accept) {
      if (!(await confirmDecline({ captainName: invite.captainName }))) return
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
    if (status === 'accepted') navigate(eventInfoPath({ tournamentId: invite.tournamentId }))
  }

  if (setup && !setup.acknowledged) {
    return <Navigate to={FINISH_ACCOUNT_PATH} state={location.state} replace />
  }

  if (!session) {
    return (
      <EmptyState
        title="Sign in to see your team invites"
        action={
          <Button onClick={() => navigate('/account')} size="md" className="mt-2">
            Sign in
          </Button>
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
          <Button onClick={() => navigate('/events')} size="md" className="mt-2">
            Go to Events
          </Button>
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
