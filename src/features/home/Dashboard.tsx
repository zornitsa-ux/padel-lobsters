import React, { lazy, Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/useApp'
import { useSettings } from '../settings/useSettings'
import { useTournaments } from '../events/useTournaments'
import { useTransfers, useTransferActions } from '../events/useTransfers'
import { usePlayers } from '../players/usePlayers'
import { useRecentMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import DEFAULT_TIPS from '../../data/padelTips'
import { AlertBox } from '../../components/ui/AlertBox'
import { useConfirm } from '../../lib/confirmBus'
import { mark } from '../../lib/perfMarks'
import { getGreeting } from './greetings'
import useGreetingName from './useGreetingName'
import useCountdown, { tournamentStartMs } from './useCountdown'
import Greeting from './Greeting'
import TransferOfferBanners from './TransferOfferBanners'
import CountdownClock from './CountdownClock'
import TipOfTheDay from './TipOfTheDay'
import NextEventCard from './NextEventCard'
import RecentlyCompletedBanners from './RecentlyCompletedBanners'
import AdminAlerts from './AdminAlerts'
import LobsterWayLink from '../../components/LobsterWayLink'
import { LeagueDashboardCard } from '../league/ui/LeagueDashboardCard'
import type { Player, NormalisedTournament } from '../../lib/normalise'
import type { NormalisedMatch } from '../events/matchQueries'
import type { NormalisedRegistration } from '../events/registrationQueries'
import type { NormalisedTransfer } from '../events/transferQueries'

// Only mounts after the player taps "share" on an outgoing transfer offer.
const TransferPendingModal = lazy(() => import('../../components/TransferPendingModal'))

interface DashboardProps {
  onNavigate: (page: string, payload?: NormalisedTournament) => void
}

interface TransferShare {
  transferId: string
  toPlayer: Player | undefined
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const confirm = useConfirm()
  const { session, sessionSettled } = useApp()
  const {
    data: tournaments = [],
    isSuccess: tournamentsLoaded,
    isPending: tournamentsPending,
    isError: tournamentsError,
  } = useTournaments()
  const { data: transfers = [], isError: transfersError } = useTransfers()
  const { respondToTransfer, cancelTransfer } = useTransferActions({ session })
  const { data: settings, isError: settingsError } = useSettings()
  const { data: players = [], isPending: playersPending, isError: playersError } = usePlayers()
  // Only the recently-completed banners read matches, and only for events
  // inside their 48h window — the all-time set is ~110KB the home screen has
  // no use for.
  const { data: matches = [], isError: matchesError } = useRecentMatches()
  const {
    data: registrations = [],
    isSuccess: registrationsLoaded,
    isPending: registrationsPending,
    isError: registrationsError,
  } = useAllRegistrations()

  // A failed read renders as an empty list/undefined, which looks identical
  // to "genuinely nothing there" (e.g. NextEventCard's "No upcoming events"
  // empty state). One combined banner is enough to tell the player the page
  // is missing data rather than reflecting reality — the rest of the
  // dashboard still renders with whatever partial data did load.
  const hasLoadError =
    tournamentsError ||
    transfersError ||
    settingsError ||
    playersError ||
    matchesError ||
    registrationsError

  const getTournamentMatches = useCallback(
    (id: string): NormalisedMatch[] => matches.filter((m) => m.tournamentId === id),
    [matches],
  )
  const getTournamentRegistrations = useCallback(
    (id: string): NormalisedRegistration[] => registrations.filter((r) => r.tournamentId === id),
    [registrations],
  )
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  // Pending-transfer state surfaced on the home screen so the player
  // sees their open offers right after reload — even before drilling
  // into a tournament. Sourced from the eagerly-loaded transfers
  // slice in AppContext, so it survives page reloads.
  const myIncomingTransfers = transfers.filter(
    (t) => t.status === 'pending' && claimedId && String(t.toPlayerId) === String(claimedId),
  )
  const myOutgoingTransfers = transfers.filter(
    (t) => t.status === 'pending' && claimedId && String(t.fromPlayerId) === String(claimedId),
  )
  const [transferShare, setTransferShare] = useState<TransferShare | null>(null)
  const [transferBusy, setTransferBusy] = useState<string | null>(null)
  const handleIncomingResponse = async (xfer: NormalisedTransfer, accept: boolean) => {
    setTransferBusy(xfer.id)
    const r = await respondToTransfer(xfer.id, accept)
    setTransferBusy(null)
    if (!r.ok) {
      const map: Record<string, string> = {
        wrong_pin: 'Sign in again to respond.',
        forbidden: 'This transfer is for a different player.',
        not_pending: 'This transfer was already responded to or closed.',
        tournament_started: 'Too late — the event has already started.',
      }
      alert(map[r.status] || 'Could not record your response.')
    }
  }
  const handleOutgoingCancel = async (xfer: NormalisedTransfer) => {
    if (
      !(await confirm({
        message: 'Cancel the transfer offer? Your spot stays registered to you.',
        destructive: true,
      }))
    )
      return
    setTransferBusy(xfer.id)
    await cancelTransfer(xfer.id)
    setTransferBusy(null)
  }
  const handleOutgoingShare = (xfer: NormalisedTransfer, toPlayer: Player | undefined) => {
    setTransferShare({ transferId: xfer.id, toPlayer })
  }

  const claimedPlayer = claimedId ? players.find((p) => p.id === claimedId) : null

  // Recently completed tournaments. The window must stay inside
  // RECENT_MATCH_WINDOW_DAYS, or a banner renders with no matches to score.
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
  const completedAtMs = (t: NormalisedTournament) =>
    new Date(t.date || t.completedAt || 0).getTime()
  const recentlyCompleted = tournaments
    .filter((t) => {
      if (t.status !== 'completed') return false
      const refDate = t.date || t.completedAt
      if (!refDate) return false
      return Date.now() - new Date(refDate).getTime() < TWO_DAYS_MS
    })
    .sort((a, b) => completedAtMs(b) - completedAtMs(a))

  // Next upcoming tournament
  const upcoming = tournaments
    .filter((t) => t.status === 'upcoming' || t.status === 'active')
    .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1))[0]

  const regs = upcoming ? getTournamentRegistrations(upcoming.id) : []
  const unpaid = regs.filter(
    (r) =>
      r.status === 'registered' && r.paymentStatus !== 'paid' && r.paymentStatus !== 'transferred',
  )

  const isRegistered =
    upcoming && claimedId
      ? regs.some((r) => r.playerId === claimedId && r.status === 'registered')
      : false

  // Live countdown — targets the nearest event whose start time is still in the
  // future. Once the current event starts, the clock automatically flips to the
  // next one so there's always a countdown visible when future events exist.
  const allUpcoming = tournaments
    .filter((t) => t.status === 'upcoming' || t.status === 'active')
    .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1))
  const countdownTournament =
    allUpcoming.find((t) => {
      const start = tournamentStartMs(t)
      return start !== null && start > Date.now()
    }) || null
  const countdown = useCountdown(countdownTournament)

  // Attendance streak — consecutive completed tournaments the player registered
  // for. Shown in CountdownClock as a motivational nudge.
  const myStreak = useMemo(() => {
    if (!claimedId) return 0
    const completed = tournaments
      .filter((t) => t.status === 'completed')
      .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))
    let s = 0
    for (const t of completed) {
      if (
        getTournamentRegistrations(t.id).some(
          (r) => r.playerId === claimedId && r.status === 'registered',
        )
      )
        s++
      else break
    }
    return s
  }, [claimedId, tournaments, getTournamentRegistrations])

  const formatDate = (d: string | null | undefined): string => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  // Greeting — members get the rotating "Snap snap, {name}!" set, guests
  // (no claimed player, no admin, no league admin) get a generic welcome
  // that invites them to sign in. Keeps the home page identical for
  // logged-in and logged-out visitors except for the top line.
  //
  // The name comes from the roster, which lands after the session does. Rather
  // than greet a placeholder and swap (see useGreetingName), reuse the name
  // cached from the last visit, and if there isn't one, hold the greeting until
  // the roster resolves.
  //
  // Before the session settles claimedId is null, which is indistinguishable
  // from a real guest — greeting a member with "sign in with your PIN" and then
  // swapping is worse than holding the line for the few ms auth takes.
  const isGuest = !claimedId && !isAdmin
  const greetingName = useGreetingName({ playerId: claimedId, name: claimedPlayer?.name })
  const nameStillLoading = !sessionSettled || (!!claimedId && !greetingName && playersPending)
  const [greetHello, greetSub] = isGuest
    ? ['Welcome to Padel Lobsters!', 'Sign in with your PIN to join the fun.']
    : getGreeting(greetingName || (isAdmin ? 'Admin' : null))

  // Marks are first-call-wins, so both conditions have to mean "settled", not
  // "nothing loaded yet": before the session resolves claimedId is null, and an
  // empty list is a legitimate loaded state.
  const greetingReady = sessionSettled && !nameStillLoading
  const homeDataReady = tournamentsLoaded && registrationsLoaded
  useEffect(() => {
    if (greetingReady) mark('greeting')
    if (homeDataReady) mark('home-data')
  }, [greetingReady, homeDataReady])

  const tips =
    settings?.padelTips && settings.padelTips.length > 0 ? settings.padelTips : DEFAULT_TIPS
  const todayTip = useMemo(() => {
    const now = new Date()
    const dayIndex = (now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate()) % tips.length
    return tips[dayIndex]
  }, [tips])

  return (
    <div className="-mx-4">
      <div className="px-4 pt-4 space-y-5">
        <Greeting hello={greetHello} sub={greetSub} loading={nameStillLoading} />

        {hasLoadError && (
          <AlertBox variant="error">
            Some dashboard data couldn&apos;t load. Pull to refresh or try again in a moment.
          </AlertBox>
        )}

        <TransferOfferBanners
          incomingTransfers={myIncomingTransfers}
          outgoingTransfers={myOutgoingTransfers}
          players={players}
          tournaments={tournaments}
          transferBusy={transferBusy}
          onIncomingResponse={handleIncomingResponse}
          onOutgoingCancel={handleOutgoingCancel}
          onOutgoingShare={handleOutgoingShare}
        />
        {transferShare && (
          <Suspense fallback={null}>
            <TransferPendingModal
              transferId={transferShare.transferId}
              toPlayer={transferShare.toPlayer}
              onClose={() => setTransferShare(null)}
              onCancel={() => setTransferShare(null)}
            />
          </Suspense>
        )}

        <CountdownClock countdown={countdown} streak={myStreak} loading={tournamentsPending} />

        <TipOfTheDay tip={todayTip} />

        <LeagueDashboardCard myPlayerId={claimedId} />

        <NextEventCard
          upcoming={upcoming}
          isAdmin={isAdmin}
          claimedId={claimedId}
          isRegistered={isRegistered}
          loading={tournamentsPending}
          registrationsPending={registrationsPending}
          onNavigate={onNavigate}
          formatDate={formatDate}
        />

        <RecentlyCompletedBanners
          recentlyCompleted={recentlyCompleted}
          getTournamentMatches={getTournamentMatches}
          getTournamentRegistrations={getTournamentRegistrations}
          players={players}
          isAdmin={isAdmin}
          onNavigate={onNavigate}
        />

        <AdminAlerts
          isAdmin={isAdmin}
          unpaid={unpaid}
          upcomingEvent={upcoming}
          players={players}
          onNavigate={onNavigate}
        />

        <LobsterWayLink />
      </div>
    </div>
  )
}
