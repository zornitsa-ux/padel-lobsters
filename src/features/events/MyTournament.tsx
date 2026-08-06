import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle, Clock, ExternalLink, Send, Trophy, UserRoundX } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useRegistrations, useRegistrationActions } from './useRegistrations'
import { useMatches } from './useMatches'
import { usePlayers } from '../players/usePlayers'
import { useEventPhase } from './useEventPhase'
import { useTournamentSync } from './useTournamentSync'
import { resultsWithheld } from './resultsPhase'
import { splitRegistrationsByStatus, computePaymentConfig } from './registration/utils'
import { fmtEur } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import MyRounds from './MyRounds'
import { useSelfRegister } from './registration/useSelfRegister'
import { buildMyTournamentView, myFinalPlacing } from './nextMatch'
import type { EventPhase } from './eventPhase'
import type { NormalisedTournament } from '../../lib/normalise'
import type { EventNavigate } from './eventHelpers'

type Props = {
  tournament: NormalisedTournament
  onNavigate: EventNavigate
}

export default function MyTournament({ tournament, onNavigate }: Props) {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
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
  // scope". Same gate as Schedule and Scores: off once scores are frozen.
  useTournamentSync({
    tournamentId: tournament.id,
    enabled: claimedId != null && tournament.status !== 'completed',
  })

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

  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const selfRegister = useSelfRegister({
    tournamentId: tournament.id,
    playerId: claimedId,
    maxPlayers: tournament.maxPlayers || 16,
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
      registering={selfRegister.registering}
      registerError={selfRegister.error}
      onRegister={() => void selfRegister.register()}
      onTikkieClick={handleTikkieClick}
      onSelfDeclare={handleSelfDeclare}
    />
  )

  const roundsSection = (
    <MyRounds
      key="rounds"
      rounds={view.rounds}
      currentRound={view.currentRound}
      getPlayer={getPlayer}
    />
  )

  const placingSection =
    !withheld && placing ? <PlacingCard key="placing" placing={placing} /> : null

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
  isAdminAll,
  costPerPlayer,
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
  isAdminAll: boolean
  costPerPlayer: number
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
    <p role="alert" className="text-xs font-semibold text-red-600">
      {registerError}
    </p>
  ) : null

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
        <button
          onClick={onRegister}
          disabled={registering}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {registering ? 'Signing up…' : 'Register again'}
        </button>
        {registerErrorNotice}
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
