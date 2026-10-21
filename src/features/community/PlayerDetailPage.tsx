import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { usePlayers, usePlayerActions } from '../players/usePlayers'
import { useTournaments } from '../events/useTournaments'
import { useAllMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import { PageHeader } from '../../components/ui/PageHeader'
import { AlertBox } from '../../components/ui/AlertBox'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import Avatar from '../../components/ui/Avatar'
import { FlagImg } from '../../components/ui/CountryPicker'
import { errorMessage } from '../../lib/errors'
import { useConfirm } from '../../lib/confirmBus'
import PlayerProfile from './PlayerProfile'
import PlayerForm from './PlayerForm'
import InviteSentModal from './InviteSentModal'
import { corpReview } from './reviewScenarios'
import { levelBadgeClass } from './playerConstants'
import { usePlayerEditor } from './usePlayerEditor'
import { buildFirstNameCount, getDisplayName } from './playersSelectors'
import type { CommunityPlayer } from './playersSelectors'
import type { InviteSent } from './InviteSentModal'
import { describeInviteError } from '../players/inviteErrors'
import type { EventNavigate } from '../events/eventHelpers'

const BACK_LINK = { to: '/community', label: 'Community' }

interface PlayerDetailPageProps {
  playerId: string
  onNavigate?: EventNavigate
}

function PlayerHero({
  player,
  review,
}: {
  player: CommunityPlayer
  review: ReturnType<typeof corpReview>
}) {
  const level = player.playtomicLevel || 0
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <Avatar player={player} size="xl" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lob-dark flex items-center gap-1.5">
            {player.country && <FlagImg code={player.country} />}
            <span className="truncate">{player.name}</span>
          </p>
          <span
            className={`inline-block mt-1 text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadgeClass(level)}`}
          >
            {level.toFixed(1)}
          </span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-lob-teal uppercase tracking-wider mb-0.5">
          Lobster Review
        </p>
        <p className="text-xs text-lob-muted leading-relaxed">
          {review.hasLabel && (
            <span className="font-bold text-lob-teal">{review.scenarioLabel}</span>
          )}
          {review.hasLabel ? ' — ' : ''}
          {review.body}
        </p>
      </div>
    </div>
  )
}

export default function PlayerDetailPage({ playerId, onNavigate }: PlayerDetailPageProps) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { session, role } = useApp()
  const isAdmin = role === 'admin'
  const { deletePlayer, resendInvite } = usePlayerActions({ session, role })
  const { data: players = [], isLoading } = usePlayers()
  const { data: tournaments = [] } = useTournaments()
  const { data: matches = [] } = useAllMatches()
  const { data: registrations = [] } = useAllRegistrations()
  const editor = usePlayerEditor({ isAdmin })
  const [inviteSent, setInviteSent] = useState<InviteSent | null>(null)
  const [error, setError] = useState('')

  const player = players.find((p) => String(p.id) === playerId) ?? null
  const firstNameCount = useMemo(
    () => buildFirstNameCount(players.filter((p) => (p.status || 'active') === 'active')),
    [players],
  )

  if (isLoading) return <Spinner />
  if (!player) {
    return (
      <div className="-mx-4">
        <PageHeader title="Player" backLink={BACK_LINK} />
        <div className="px-4 pt-4">
          <EmptyState icon={<User size={36} />} title="This player could not be found." />
        </div>
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: 'Remove this player?', destructive: true }))) return
    setError('')
    try {
      await deletePlayer(id)
      navigate('/community', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not remove player.'))
    }
  }

  const handleResendInvite = async (p: CommunityPlayer) => {
    setError('')
    try {
      const result = await resendInvite(p.id)
      setInviteSent({ name: (p.name || '').split(' ')[0] || 'Player', email: result.email })
    } catch (err) {
      setError(describeInviteError({ error: err, fallback: 'Could not resend the invite.' }))
    }
  }

  const visibleError = error || editor.error
  const review = corpReview(player, matches, registrations, tournaments)

  return (
    <div className="-mx-4">
      <PageHeader
        title={getDisplayName(player.name, firstNameCount)}
        eyebrow="Community"
        backLink={BACK_LINK}
      />
      <div className="px-4 pt-4 space-y-4">
        {visibleError && (
          <AlertBox
            variant="error"
            onDismiss={() => {
              setError('')
              editor.clearError()
            }}
            className="text-xs"
          >
            {visibleError}
          </AlertBox>
        )}
        <PlayerHero player={player} review={review} />
        <div className="card">
          <PlayerProfile
            player={player}
            players={players}
            matches={matches}
            tournaments={tournaments}
            registrations={registrations}
            isAdmin={isAdmin}
            onNavigate={onNavigate}
            onEdit={editor.openEdit}
            onDelete={handleDelete}
            onResendInvite={handleResendInvite}
          />
        </div>
      </div>
      <InviteSentModal inviteSent={inviteSent} onClose={() => setInviteSent(null)} />
      <PlayerForm {...editor.formProps} />
    </div>
  )
}
