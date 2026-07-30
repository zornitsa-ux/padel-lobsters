import { useMemo, useState, type ReactNode } from 'react'
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Send,
  Trophy,
  MapPin,
  Users,
  UserRoundX,
} from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useRegistrations, useRegistrationActions } from './useRegistrations'
import { useMatches } from './useMatches'
import { usePlayers } from '../players/usePlayers'
import { useEventPhase } from './useEventPhase'
import { resultsWithheld } from './resultsPhase'
import { splitRegistrationsByStatus, computePaymentConfig } from './registration/utils'
import { fmtEur } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import Avatar from '../../components/ui/Avatar'
import { buildMyTournamentView, matchOutcome, myFinalPlacing, type MyMatchView } from './nextMatch'
import type { EventPhase } from './eventPhase'
import type { NormalisedTournament, Player } from '../../lib/normalise'
import type { EventNavigate } from './eventHelpers'

type Props = {
  tournament: NormalisedTournament
  onNavigate: EventNavigate
}

const firstName = (player: Player | undefined, fallback: string): string =>
  player ? (player.name || fallback).split(' ')[0] : fallback

export default function MyTournament({ tournament, onNavigate }: Props) {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  const { data: registrations = [] } = useRegistrations(tournament.id)
  const { data: matches = [] } = useMatches(tournament.id)
  const { data: players = [] } = usePlayers()
  const { registerPlayer, updateRegistration } = useRegistrationActions()

  const { phase } = useEventPhase(tournament)
  const withheld = resultsWithheld({ tournament, isAdmin })

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const getPlayer = (id: string | null) => (id ? playerById.get(id) : undefined)

  const view = useMemo(
    () => buildMyTournamentView({ registrations, matches, playerId: claimedId }),
    [registrations, matches, claimedId],
  )

  const { registered, waitlisted } = useMemo(
    () => splitRegistrationsByStatus(registrations),
    [registrations],
  )
  const { isAdminAll, hasTikkie, costPerPlayer } = useMemo(
    () => computePaymentConfig(tournament),
    [tournament],
  )
  const isEventFull = registered.length >= (tournament.maxPlayers || 16)

  const placing = useMemo(() => {
    if (withheld || !claimedId) return null
    return myFinalPlacing({
      tournamentId: tournament.id,
      matches,
      playerId: claimedId,
      registeredPlayerIds: registered.map((r) => r.playerId),
    })
  }, [withheld, claimedId, tournament.id, matches, registered])

  const [registering, setRegistering] = useState(false)
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const handleRegister = async () => {
    if (!claimedId) return
    setRegistering(true)
    try {
      await registerPlayer(tournament.id, claimedId, tournament.maxPlayers || 16)
    } finally {
      setRegistering(false)
    }
  }

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
        action={
          <button
            onClick={() => onNavigate('settings')}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            Go to Settings
          </button>
        }
      />
    )
  }

  const registrationSection = (
    <RegistrationCard
      key="registration"
      registration={view.registration}
      isEventFull={isEventFull}
      waitlistPosition={waitlisted.findIndex((r) => r.playerId === claimedId) + 1 || undefined}
      hasTikkie={hasTikkie}
      isAdminAll={isAdminAll}
      costPerPlayer={costPerPlayer}
      tournament={tournament}
      tikkieClicked={tikkieClicked}
      declaring={declaring}
      registering={registering}
      onRegister={handleRegister}
      onTikkieClick={handleTikkieClick}
      onSelfDeclare={handleSelfDeclare}
    />
  )

  const nextMatchSection =
    view.nextMatch || view.sittingOutCurrentRound ? (
      <NextMatchCard
        key="next-match"
        nextMatch={view.nextMatch}
        sittingOut={view.sittingOutCurrentRound}
        currentRound={view.currentRound}
        getPlayer={getPlayer}
      />
    ) : null

  const laterMatches = view.upcomingMatches.slice(view.nextMatch ? 1 : 0)
  const matchesSection =
    laterMatches.length > 0 || view.completedMatches.length > 0 ? (
      <MyMatchesCard
        key="matches"
        later={laterMatches}
        completed={view.completedMatches}
        getPlayer={getPlayer}
      />
    ) : null

  const placingSection =
    !withheld && placing ? <PlacingCard key="placing" placing={placing} /> : null

  const sectionsByPhase: Record<EventPhase, ReactNode[]> = {
    open: [registrationSection],
    set: [registrationSection, nextMatchSection],
    live: [nextMatchSection, matchesSection, registrationSection],
    sealed: [matchesSection, registrationSection],
    social: [matchesSection, registrationSection],
    revealed: [placingSection, matchesSection, registrationSection],
  }

  return <div className="space-y-4">{sectionsByPhase[phase]}</div>
}

// ── Registration + payment ──────────────────────────────────────────────────

function RegistrationCard({
  registration,
  isEventFull,
  waitlistPosition,
  hasTikkie,
  isAdminAll,
  costPerPlayer,
  tournament,
  tikkieClicked,
  declaring,
  registering,
  onRegister,
  onTikkieClick,
  onSelfDeclare,
}: {
  registration: ReturnType<typeof buildMyTournamentView>['registration']
  isEventFull: boolean
  waitlistPosition?: number
  hasTikkie: boolean
  isAdminAll: boolean
  costPerPlayer: number
  tournament: NormalisedTournament
  tikkieClicked: boolean
  declaring: boolean
  registering: boolean
  onRegister: () => void
  onTikkieClick: () => void
  onSelfDeclare: () => void
}) {
  if (registration.status === 'not_registered') {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-lob-muted">
          {isEventFull ? 'This event is full.' : "You haven't signed up yet."}
        </p>
        <button
          onClick={onRegister}
          disabled={registering}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {registering
            ? 'Signing up…'
            : isEventFull
              ? 'Join the waitlist'
              : 'Register for this event'}
        </button>
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
        <button
          onClick={onRegister}
          disabled={registering}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {registering ? 'Signing up…' : 'Register again'}
        </button>
      </div>
    )
  }

  if (registration.status === 'waitlisted') {
    return (
      <div className="card bg-amber-50 border border-amber-200 space-y-1">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            You&apos;re on the waitlist{waitlistPosition ? ` · #${waitlistPosition}` : ''}
          </p>
        </div>
        <p className="text-xs text-amber-700 pl-5">You&apos;ll be notified if a spot opens up.</p>
      </div>
    )
  }

  // status === 'registered'
  const ps = registration.paymentStatus
  const isConfirmed = ps === 'paid' || ps === 'transferred'
  const isTikkied = ps === 'tikkied'
  const isSelfDeclared = ps === 'pending_confirmation'
  const needsPayment = (!ps || ps === 'unpaid') && hasTikkie

  const badge = (
    <div className="flex items-center gap-2">
      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
      <span className="text-sm font-semibold text-lob-dark">You&apos;re registered</span>
    </div>
  )

  if (needsPayment) {
    const tikkieLinks: Array<{ label: string | null; url: string }> = isAdminAll
      ? tournament.tikkieLink
        ? [{ label: null, url: tournament.tikkieLink }]
        : []
      : (tournament.courts || [])
          .filter((c) => c.tikkieLink)
          .map((c, i) => ({ label: c.name || `Court ${i + 1}`, url: c.tikkieLink as string }))

    return (
      <div className="card space-y-3">
        {badge}
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-3 space-y-2">
          <p className="text-xs font-semibold text-orange-800">
            Pay to lock your spot{costPerPlayer > 0 ? ` · ${fmtEur(costPerPlayer)}` : ''}
          </p>
          {tikkieLinks.map(({ label, url }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onTikkieClick}
              className="inline-flex items-center gap-1.5 bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
            >
              <ExternalLink size={14} />
              {label ? `Pay for ${label}` : 'Pay via Tikkie'}
            </a>
          ))}
        </div>
        {tikkieClicked && (
          <button
            onClick={onSelfDeclare}
            disabled={declaring}
            className="w-full flex items-center justify-center gap-2 border-2 border-lob-teal text-lob-teal font-semibold py-2.5 rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
          >
            <Send size={14} /> {declaring ? 'Saving…' : "I've sent the payment"}
          </button>
        )}
      </div>
    )
  }

  if (isTikkied || isSelfDeclared) {
    return (
      <div className="card space-y-3">
        {badge}
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
          <p className="text-xs font-semibold text-sky-700">
            {isTikkied
              ? '🔗 Tikkie sent · awaiting admin confirmation'
              : '💬 Payment declared · admin will confirm shortly'}
          </p>
        </div>
      </div>
    )
  }

  if (isConfirmed) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          {badge}
          <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            ✓ Confirmed
          </span>
        </div>
      </div>
    )
  }

  // Registered, no payment required (free event or no Tikkie configured)
  return <div className="card">{badge}</div>
}

// ── Next match hero ──────────────────────────────────────────────────────────

function NextMatchCard({
  nextMatch,
  sittingOut,
  currentRound,
  getPlayer,
}: {
  nextMatch: MyMatchView | null
  sittingOut: boolean
  currentRound: number | null
  getPlayer: (id: string | null) => Player | undefined
}) {
  if (!nextMatch) {
    return (
      <div className="card-elevated bg-lob-cream text-center space-y-1">
        <p className="text-sm font-semibold text-lob-slate">
          Sitting out{currentRound ? ` — Round ${currentRound}` : ' this round'}
        </p>
        <p className="text-xs text-lob-muted">Grab a drink — you&apos;re back next round.</p>
      </div>
    )
  }

  const partner = getPlayer(nextMatch.partnerId)
  const opponents = nextMatch.opponentIds.map((id) => getPlayer(id))

  return (
    <div className="card-elevated space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-lob-teal bg-lob-cream px-2.5 py-1 rounded-full">
          Round {nextMatch.round}
        </span>
        {nextMatch.court && (
          <span className="flex items-center gap-1 text-sm font-bold text-lob-dark">
            <MapPin size={14} className="text-lob-coral" />
            Court {nextMatch.court}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Avatar player={partner ?? { name: '?' }} size="lg" />
        <div className="text-left">
          <p className="text-xs text-lob-muted-light">with</p>
          <p className="font-bold text-lob-dark">{firstName(partner, 'Partner TBD')}</p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold text-lob-muted-light uppercase tracking-wide">vs</p>
        <div className="flex items-center justify-center gap-3 mt-1">
          {opponents.map((opp, i) => (
            <div key={nextMatch.opponentIds[i] ?? i} className="flex items-center gap-1.5">
              <Avatar player={opp ?? { name: '?' }} size="sm" />
              <span className="text-sm font-medium text-lob-slate">{firstName(opp, 'TBD')}</span>
            </div>
          ))}
        </div>
      </div>

      {sittingOut && (
        <p className="text-xs text-center text-lob-muted-light">
          (Sitting out the current round — this is your next match up)
        </p>
      )}
    </div>
  )
}

// ── My matches list ───────────────────────────────────────────────────────────

function MatchRow({
  view,
  getPlayer,
}: {
  view: MyMatchView
  getPlayer: (id: string | null) => Player | undefined
}) {
  const partner = getPlayer(view.partnerId)
  const opponents = view.opponentIds.map((id) => getPlayer(id))
  const outcome = matchOutcome(view)

  const outcomeBadge =
    outcome === 'win' ? (
      <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        Won
      </span>
    ) : outcome === 'loss' ? (
      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        Lost
      </span>
    ) : outcome === 'tie' ? (
      <span className="text-xs font-bold text-lob-muted bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
        Tied
      </span>
    ) : null

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-lob-muted-light">
          Round {view.round}
          {view.court ? ` · Court ${view.court}` : ''}
        </p>
        <p className="text-sm text-lob-slate truncate">
          with <span className="font-medium">{firstName(partner, 'Partner TBD')}</span> vs{' '}
          {opponents.map((o) => firstName(o, 'TBD')).join(' & ')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 pl-2">
        {view.scored ? (
          <>
            <span className="text-sm font-bold text-lob-slate">
              {view.myScore}–{view.opponentScore}
            </span>
            {outcomeBadge}
          </>
        ) : (
          <span className="text-xs text-lob-muted-light">Upcoming</span>
        )}
      </div>
    </div>
  )
}

function MyMatchesCard({
  later,
  completed,
  getPlayer,
}: {
  later: MyMatchView[]
  completed: MyMatchView[]
  getPlayer: (id: string | null) => Player | undefined
}) {
  return (
    <div className="space-y-3">
      {later.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-lob-slate text-sm mb-1">Your remaining matches</h3>
          {later.map((v) => (
            <MatchRow key={v.match.id} view={v} getPlayer={getPlayer} />
          ))}
        </div>
      )}
      {completed.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-lob-slate text-sm mb-1 flex items-center gap-1.5">
            <Users size={14} className="text-lob-teal" /> Your results
          </h3>
          {completed.map((v) => (
            <MatchRow key={v.match.id} view={v} getPlayer={getPlayer} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Final placing (revealed phase only) ───────────────────────────────────────

function PlacingCard({ placing }: { placing: { rank: number; total: number } }) {
  return (
    <div className="card-elevated bg-gradient-to-r from-yellow-400 to-lob-coral text-white text-center space-y-1">
      <Trophy size={28} className="mx-auto" />
      <p className="text-2xl font-bold">
        #{placing.rank} <span className="text-base font-medium">of {placing.total}</span>
      </p>
      <p className="text-sm opacity-90">Your final placing this event</p>
    </div>
  )
}
