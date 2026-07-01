import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/useApp'
import { useSettings } from '../settings/useSettings'
import { useTournaments } from '../events/useTournaments'
import { useTransfers, useTransferActions } from '../events/useTransfers'
import useRefreshOnFocus from '../../hooks/useRefreshOnFocus'
import { usePlayers } from '../players/usePlayers'
import { useAllMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import { supabase } from '../../supabase'
import DEFAULT_TIPS from '../../data/padelTips'
import TransferPendingModal from '../../components/TransferPendingModal'
import { getGreeting } from './greetings'
import useCountdown from './useCountdown'
import Greeting from './Greeting'
import TransferOfferBanners from './TransferOfferBanners'
import CountdownClock from './CountdownClock'
import TipOfTheDay from './TipOfTheDay'
import NextEventCard from './NextEventCard'
import RecentlyCompletedBanners from './RecentlyCompletedBanners'
import AdminAlerts from './AdminAlerts'
import { LeagueDashboardCard } from '../league/ui/LeagueDashboardCard'

export default function Dashboard({ onNavigate }) {
  const { session } = useApp()
  const { data: tournaments = [] } = useTournaments()
  const { data: transfers = [] } = useTransfers()
  const { respondToTransfer, cancelTransfer } = useTransferActions({ session })
  const { data: settings } = useSettings()
  const { data: players = [] } = usePlayers()
  const { data: matches = [] } = useAllMatches()
  const { data: registrations = [] } = useAllRegistrations()

  const getTournamentMatches = useCallback(
    (id) => matches.filter((m) => m.tournamentId === id),
    [matches],
  )
  const getTournamentRegistrations = useCallback(
    (id) => registrations.filter((r) => r.tournamentId === id),
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
  const [transferShare, setTransferShare] = useState(null) // { transferId, toPlayer }
  const [transferBusy, setTransferBusy] = useState(null) // transferId being acted on
  const handleIncomingResponse = async (xfer, accept) => {
    setTransferBusy(xfer.id)
    const r = await respondToTransfer(xfer.id, accept)
    setTransferBusy(null)
    if (!r.ok) {
      const map = {
        wrong_pin: 'Sign in again to respond.',
        forbidden: 'This transfer is for a different player.',
        not_pending: 'This transfer was already responded to or closed.',
        tournament_started: 'Too late — the event has already started.',
      }
      alert(map[r.status] || 'Could not record your response.')
    }
  }
  const handleOutgoingCancel = async (xfer) => {
    if (!confirm('Cancel the transfer offer? Your spot stays registered to you.')) return
    setTransferBusy(xfer.id)
    await cancelTransfer(xfer.id)
    setTransferBusy(null)
  }
  const handleOutgoingShare = (xfer, toPlayer) => {
    setTransferShare({ transferId: xfer.id, toPlayer })
  }

  const claimedPlayer = claimedId ? players.find((p) => p.id === claimedId) : null

  // ── New merch orders since last admin check ─────────────────────────────────
  const [newOrders, setNewOrders] = useState([])
  const LAST_CHECK_KEY = 'pl_merch_last_checked'

  const loadNewOrders = useCallback(async () => {
    if (!isAdmin) return
    const lastChecked = localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString()
    const [ordersRes, itemsRes] = await Promise.all([
      supabase
        .from('merch_interests')
        .select('*')
        .gte('created_at', lastChecked)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('merch_items').select('id, name').eq('active', true),
    ])
    const orders = ordersRes.data || []
    const itemMap = Object.fromEntries((itemsRes.data || []).map((i) => [i.id, i.name]))
    // Match player names from context players array
    setNewOrders(
      orders.map((o) => {
        const p = players.find((pl) => String(pl.id) === String(o.player_id))
        return { ...o, playerName: p?.name || null, itemName: itemMap[o.merch_item_id] || 'item' }
      }),
    )
  }, [isAdmin, players])

  useEffect(() => {
    loadNewOrders()
  }, [loadNewOrders])

  // Flat read (tournament IO refactor): refresh new-order count on tab focus
  // instead of holding a realtime channel open.
  useRefreshOnFocus(loadNewOrders)

  const dismissMerchOrders = () => {
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())
    setNewOrders([])
  }

  const formatUpdateTime = (ts) => {
    if (!ts) return ''
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Recently completed tournaments (within 48 hours of tournament date)
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
  const recentlyCompleted = tournaments
    .filter((t) => {
      if (t.status !== 'completed') return false
      const refDate = t.date || t.completedAt
      if (!refDate) return false
      return Date.now() - new Date(refDate).getTime() < TWO_DAYS_MS
    })
    .sort((a, b) => new Date(b.date || b.completedAt) - new Date(a.date || a.completedAt))

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
      if (!t.date) return false
      const [y, mo, d] = t.date.split('-').map(Number)
      if (!y) return false
      const timeStr = (t.time || '').trim()
      let hh = 19,
        mm = 0
      const ampm = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
      const hm = timeStr.match(/^(\d{1,2})[:.](\d{2})$/)
      if (ampm) {
        hh = parseInt(ampm[1], 10) % 12
        if (/pm/i.test(ampm[3])) hh += 12
        mm = parseInt(ampm[2] || '0', 10)
      } else if (hm) {
        hh = parseInt(hm[1], 10)
        mm = parseInt(hm[2], 10)
      }
      return new Date(y, mo - 1, d, hh, mm).getTime() > Date.now()
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

  const formatDate = (d) => {
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
  const isGuest = !claimedId && !isAdmin
  const [greetHello, greetSub] = isGuest
    ? ['Welcome to Padel Lobsters!', 'Sign in with your PIN to join the fun.']
    : getGreeting(claimedPlayer?.name || (isAdmin ? 'Admin' : null))

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
        <Greeting hello={greetHello} sub={greetSub} />

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
          <TransferPendingModal
            transferId={transferShare.transferId}
            toPlayer={transferShare.toPlayer}
            onClose={() => setTransferShare(null)}
            onCancel={() => setTransferShare(null)}
          />
        )}

        <CountdownClock countdown={countdown} streak={myStreak} />

        <TipOfTheDay tip={todayTip} />

        <LeagueDashboardCard myPlayerId={claimedId} />

        <NextEventCard
          upcoming={upcoming}
          isAdmin={isAdmin}
          claimedId={claimedId}
          isRegistered={isRegistered}
          onNavigate={onNavigate}
          formatDate={formatDate}
        />

        <RecentlyCompletedBanners
          recentlyCompleted={recentlyCompleted}
          getTournamentMatches={getTournamentMatches}
          getTournamentRegistrations={getTournamentRegistrations}
          players={players}
          onNavigate={onNavigate}
        />

        <AdminAlerts
          isAdmin={isAdmin}
          unpaid={unpaid}
          upcomingEvent={upcoming}
          players={players}
          newOrders={newOrders}
          onDismissMerch={dismissMerchOrders}
          formatUpdateTime={formatUpdateTime}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}
