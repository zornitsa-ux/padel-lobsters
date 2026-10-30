import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle, Trophy, UserRoundX } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useRegistrations, useRegistrationActions } from './useRegistrations'
import { useMatches } from './useMatches'
import { usePlayers } from '../players/usePlayers'
import { useEventPhase } from './useEventPhase'
import { useTournamentSync } from './useTournamentSync'
import { hasLiveScores, isKingOfTheCourt } from './eventFormat'
import { resultsWithheld } from './resultsPhase'
import { splitRegistrationsByStatus, computePaymentConfig } from './registration/utils'
import { EmptyState } from '../../components/ui/EmptyState'
import MyRounds from './MyRounds'
import { useSelfRegister } from './registration/useSelfRegister'
import PayPrompt from './registration/PayPrompt'
import MyTeamRegistration from './registration/team/MyTeamRegistration'
import { eligiblePlayers, findMyEntry } from './registration/team/teamHelpers'
import { useTeamEntries } from './teams/useTeams'
import { useMyKingOfCourt } from './kingOfCourt/useKingOfCourtTeams'
import MyStartingCourtCard from './kingOfCourt/MyStartingCourtCard'
import { buildMyTournamentView, myFinalPlacing } from './nextMatch'
import type { EventPhase } from './eventPhase'
import { isEventOver } from './eventPhase'
import type { NormalisedTournament } from '../../lib/normalise'
import type { EventNavigate } from './eventHelpers'
import { Button } from '../../components/ui/Button'
import WaitlistNotice from './registration/WaitlistNotice'
import { AlertBox } from '../../components/ui/AlertBox'
import { isSettled } from './paymentStatus'
import PaymentStatusBadge from './registration/PaymentStatusBadge'

type Props = {
  tournament: NormalisedTournament
  onNavigate: EventNavigate
}

export default function MyTournament({ tournament, onNavigate }: Props) {
  const { session, isAdmin } = useApp()
  const claimedId = session?.user?.id ?? null

  const { data: registrations = [] } = useRegistrations(tournament.id)
  const { data: matches = [] } = useMatches(tournament.id)
  const { data: players = [] } = usePlayers()
  const { updateRegistration } = useRegistrationActions()

  const { phase } = useEventPhase(tournament)
  const withheld = resultsWithheld({ tournament, isAdmin })

  // Scores land here without a refresh: peers' score deltas merge into the match
  // cache and a schedule rewrite refetches it. Broadcast-only, so this adds no
  // database load however many players hold the tab open — but it does make /me
  // the widest subscriber on the channel. See ARCHITECTURE.md "Live-update
  // scope". Same gate as Schedule and Scores.
  useTournamentSync({
    tournamentId: tournament.id,
    enabled: claimedId != null && hasLiveScores(tournament),
  })

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const getPlayer = (id: string | null | undefined) => (id ? playerById.get(id) : undefined)

  const teamEvent = tournament.entryMode === 'team'
  const { entries } = useTeamEntries({
    tournamentId: tournament.id,
    registrations,
    enabled: teamEvent && claimedId != null,
  })
  const myEntry = findMyEntry({ entries, playerId: claimedId })
  const kingOfCourt = isKingOfTheCourt(tournament)
  const kotc = useMyKingOfCourt({
    tournament,
    registrations,
    playerId: claimedId,
    enabled: kingOfCourt && claimedId != null,
  })
  const candidates = useMemo(
    () => eligiblePlayers({ players, regs: registrations, excludeIds: [claimedId] }),
    [players, registrations, claimedId],
  )

  const view = useMemo(
    () => buildMyTournamentView({ registrations, matches, playerId: claimedId }),
    [registrations, matches, claimedId],
  )

  const { registered, waitlisted } = useMemo(
    () => splitRegistrationsByStatus(registrations),
    [registrations],
  )
  const { hasTikkie, costPerEntry } = useMemo(() => computePaymentConfig(tournament), [tournament])
  const isEventFull = registered.length >= (tournament.maxPlayers || 16)

  // King of the Court's saved standings are public at once (D-026).
  const placing = useMemo(() => {
    if (kingOfCourt) return kotc.placing
    if (withheld || !claimedId) return null
    return myFinalPlacing({
      tournamentId: tournament.id,
      matches,
      playerId: claimedId,
      registeredPlayerIds: registered.map((r) => r.playerId),
    })
  }, [kingOfCourt, kotc.placing, withheld, claimedId, tournament.id, matches, registered])

  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const selfRegister = useSelfRegister({
    tournamentId: tournament.id,
    playerId: claimedId,
  })

  const handleTikkieClick = () => {
    setTikkieClicked(true)
    const reg = view.registration.registration
    if (!reg || (reg.paymentStatus && reg.paymentStatus !== 'unpaid')) return
    void updateRegistration(
      reg.id,
      { paymentStatus: 'tikkied', paymentMethod: 'tikkie' },
      tournament.id,
    )
  }

  const handleSelfDeclare = async () => {
    const reg = view.registration.registration
    if (!reg) return
    setDeclaring(true)
    try {
      await updateRegistration(
        reg.id,
        { paymentStatus: 'pending_confirmation', paymentMethod: 'tikkie' },
        tournament.id,
      )
    } finally {
      setDeclaring(false)
    }
  }

  if (!claimedId) {
    return (
      <EmptyState
        icon={<UserRoundX size={36} />}
        title="Sign in to see your tournament"
        action={<Button onClick={() => onNavigate('settings')}>Go to Settings</Button>}
      />
    )
  }

  const captainOwes =
    hasTikkie &&
    myEntry?.status === 'registered' &&
    myEntry.captain.playerId === claimedId &&
    (!myEntry.captain.paymentStatus || myEntry.captain.paymentStatus === 'unpaid')

  const registrationSection = teamEvent ? (
    <MyTeamRegistration
      key="registration"
      entry={myEntry}
      viewerId={claimedId}
      tournamentId={tournament.id}
      isCompleted={isEventOver({ tournament })}
      candidates={candidates}
      getPlayer={getPlayer}
      displayName={(p) => (p.name || '').trim()}
      pay={
        captainOwes
          ? {
              amount: costPerEntry,
              tikkieLink: tournament.tikkieLink,
              tikkieClicked,
              declaring,
              onTikkieClick: handleTikkieClick,
              onSelfDeclare: () => void handleSelfDeclare(),
            }
          : null
      }
      onSignUp={() => onNavigate('registration', tournament)}
    />
  ) : (
    <RegistrationCard
      key="registration"
      registration={view.registration}
      isEventFull={isEventFull}
      waitlistPosition={waitlisted.findIndex((r) => r.playerId === claimedId) + 1 || undefined}
      hasTikkie={hasTikkie}
      costPerEntry={costPerEntry}
      tournament={tournament}
      tikkieClicked={tikkieClicked}
      declaring={declaring}
      registering={selfRegister.registering}
      registerError={selfRegister.error}
      onRegister={() => void selfRegister.register()}
      onTikkieClick={handleTikkieClick}
      onSelfDeclare={handleSelfDeclare}
    />
  )

  const roundsSection = kingOfCourt ? (
    kotc.myTeamId && (
      <MyStartingCourtCard
        key="rounds"
        shown={kotc.shown}
        startingCourt={kotc.startingCourt}
        onSeeAll={() => onNavigate('schedule', tournament)}
      />
    )
  ) : (
    <MyRounds
      key="rounds"
      rounds={view.rounds}
      currentRound={view.currentRound}
      getPlayer={getPlayer}
    />
  )

  const placingSection = placing ? (
    <PlacingCard
      key="placing"
      placing={placing}
      label={kingOfCourt ? "Your team's final placing" : 'Your final placing this event'}
    />
  ) : null

  const sectionsByPhase: Record<EventPhase, ReactNode[]> = {
    open: [registrationSection],
    set: [registrationSection, roundsSection],
    live: [roundsSection, registrationSection],
    sealed: [roundsSection, registrationSection],
    social: [roundsSection, registrationSection],
    revealed: [placingSection, roundsSection, registrationSection],
  }

  return <div className="space-y-4">{sectionsByPhase[phase]}</div>
}

// ── Registration + payment ──────────────────────────────────────────────────

function RegistrationCard({
  registration,
  isEventFull,
  waitlistPosition,
  hasTikkie,
  costPerEntry,
  tournament,
  tikkieClicked,
  declaring,
  registering,
  registerError,
  onRegister,
  onTikkieClick,
  onSelfDeclare,
}: {
  registration: ReturnType<typeof buildMyTournamentView>['registration']
  isEventFull: boolean
  waitlistPosition?: number
  hasTikkie: boolean
  costPerEntry: number
  tournament: NormalisedTournament
  tikkieClicked: boolean
  declaring: boolean
  registering: boolean
  /** Set when the sign-up failed; blank otherwise. */
  registerError?: string
  onRegister: () => void
  onTikkieClick: () => void
  onSelfDeclare: () => void
}) {
  const registerErrorNotice = registerError ? (
    <AlertBox variant="error" size="sm">
      {registerError}
    </AlertBox>
  ) : null

  if (registration.status === 'not_registered') {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-lob-muted">
          {isEventFull ? 'This event is full.' : "You haven't signed up yet."}
        </p>
        <Button onClick={onRegister} disabled={registering} fullWidth>
          {registering
            ? 'Signing up…'
            : isEventFull
              ? 'Join the waitlist'
              : 'Register for this event'}
        </Button>
        {registerErrorNotice}
      </div>
    )
  }

  if (registration.status === 'cancelled') {
    return (
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <UserRoundX size={14} className="text-lob-muted flex-shrink-0" />
          <p className="text-sm font-semibold text-lob-slate">Your registration was cancelled</p>
        </div>
        <Button onClick={onRegister} disabled={registering} fullWidth>
          {registering ? 'Signing up…' : 'Register again'}
        </Button>
        {registerErrorNotice}
      </div>
    )
  }

  if (registration.status === 'waitlisted') {
    return <WaitlistNotice position={waitlistPosition} />
  }

  // status === 'registered'
  const ps = registration.paymentStatus
  const isConfirmed = isSettled(ps)
  const isTikkied = ps === 'tikkied'
  const isSelfDeclared = ps === 'pending_confirmation'
  const needsPayment = (!ps || ps === 'unpaid') && hasTikkie

  const badge = (
    <div className="flex items-center gap-2">
      <CheckCircle size={14} className="text-lob-success-solid flex-shrink-0" />
      <span className="text-sm font-semibold text-lob-dark">You&apos;re registered</span>
    </div>
  )

  if (needsPayment) {
    return (
      <div className="card space-y-3">
        {badge}
        <PayPrompt
          amount={costPerEntry}
          tikkieLink={tournament.tikkieLink}
          tikkieClicked={tikkieClicked}
          declaring={declaring}
          onTikkieClick={onTikkieClick}
          onSelfDeclare={onSelfDeclare}
        />
      </div>
    )
  }

  if (isTikkied || isSelfDeclared) {
    return (
      <div className="card space-y-3">
        {badge}
        <AlertBox variant="info" size="sm">
          {isTikkied
            ? '🔗 Tikkie sent · awaiting admin confirmation'
            : '💬 Payment declared · admin will confirm shortly'}
        </AlertBox>
      </div>
    )
  }

  if (isConfirmed) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          {badge}
          <PaymentStatusBadge paymentStatus={ps} />
        </div>
      </div>
    )
  }

  // Registered, no payment required (free event or no Tikkie configured)
  return <div className="card">{badge}</div>
}

// ── Final placing (revealed phase only) ───────────────────────────────────────

function PlacingCard({
  placing,
  label,
}: {
  placing: { rank: number; total: number }
  label: string
}) {
  return (
    <div className="card-elevated bg-celebrate text-white text-center space-y-1">
      <Trophy size={28} className="mx-auto" />
      <p className="text-2xl font-bold">
        #{placing.rank} <span className="text-base font-medium">of {placing.total}</span>
      </p>
      <p className="text-sm opacity-90">{label}</p>
    </div>
  )
}
