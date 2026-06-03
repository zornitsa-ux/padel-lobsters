import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import useRefreshOnFocus from '../../hooks/useRefreshOnFocus'
import { usePlayers } from '../players/usePlayers'
import { supabase } from '../../supabase'
import DEFAULT_TIPS from '../../data/padelTips'
import { TOURNAMENTS as LEGACY_TOURNAMENTS } from '../../data/historicalTournaments'
import { buildPlayerStats } from '../../lib/playerStats'
import TransferPendingModal from '../../components/TransferPendingModal'
import { getGreeting } from './greetings'
import useCountdown from './useCountdown'
import Greeting from './Greeting'
import TransferOfferBanners from './TransferOfferBanners'
import CountdownClock from './CountdownClock'
import TipOfTheDay from './TipOfTheDay'
import CommunityQuickLinks from './CommunityQuickLinks'
import NextEventCard from './NextEventCard'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import RecentlyCompletedBanners from './RecentlyCompletedBanners'
import AdminAlerts from './AdminAlerts'
import YourStatsCard from './YourStatsCard'
import RecentResultsList from './RecentResultsList'
import { LeagueDashboardCard } from '../league/ui/LeagueDashboardCard'

// (Claw up/down reaction icons removed along with the Updates feature.)

export default function Dashboard({ onNavigate }) {
  const {
    tournaments,
    registrations,
    matches,
    settings,
    getTournamentRegistrations,
    getTournamentMatches,
    session,
    transfers,
    respondToTransfer,
    cancelTransfer,
  } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null
  const { playerAliases } = usePlayerAliases()

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
  const activePlayers = players.filter((p) => (p.status || 'active') === 'active')

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
  const registered = regs.filter((r) => r.status === 'registered')
  const waitlisted = regs.filter((r) => r.status === 'waitlist')
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

  // Past completed tournaments for history section
  const pastTournaments = tournaments
    .filter((t) => t.status === 'completed')
    .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))
    .slice(0, 6)

  // Community stats
  const upcomingCount = tournaments.filter(
    (t) => t.status === 'upcoming' || t.status === 'active',
  ).length
  const pastCount =
    tournaments.filter((t) => t.status === 'completed').length + LEGACY_TOURNAMENTS.length

  // Top 3 from the last completed tournament (DB first, then legacy fallback)
  const lastPodium = useMemo(() => {
    const lastCompleted = tournaments
      .filter((t) => t.status === 'completed')
      .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))[0]
    if (lastCompleted) {
      const tRegs = getTournamentRegistrations(lastCompleted.id).filter(
        (r) => r.status === 'registered',
      )
      const tMatches = getTournamentMatches(lastCompleted.id)
      if (tMatches.length > 0) {
        const stats = {}
        tRegs.forEach((r) => {
          stats[r.playerId] = { pts: 0, won: 0 }
        })
        tMatches
          .filter((m) => m.completed && m.score1 != null)
          .forEach((m) => {
            const s1 = parseInt(m.score1) || 0,
              s2 = parseInt(m.score2) || 0
            ;(m.team1Ids || []).forEach((id) => {
              if (stats[id]) {
                stats[id].pts += s1
                if (s1 > s2) stats[id].won++
              }
            })
            ;(m.team2Ids || []).forEach((id) => {
              if (stats[id]) {
                stats[id].pts += s2
                if (s2 > s1) stats[id].won++
              }
            })
          })
        const podium = Object.entries(stats)
          .sort((a, b) => (b[1].pts !== a[1].pts ? b[1].pts - a[1].pts : b[1].won - a[1].won))
          .slice(0, 3)
          .map(([id]) => players.find((p) => p.id === id))
          .filter(Boolean)
          .map((p) => p.name.split(' ')[0])
        if (podium.length > 0) return podium
      }
    }
    // Fallback: March 2026 Lobster Tournament top 3 (with tiebreaker via match wins)
    // This will auto-replace once the next DB tournament is completed
    return ['Alex B', 'Uziel', 'Karlijn']
  }, [tournaments, matches, players, getTournamentRegistrations, getTournamentMatches])

  // ── Personal stats for claimed player ──────────────────────────────────────
  // Uses the SHARED buildPlayerStats helper (../lib/playerStats) so the home
  // card and the Players-tab expanded profile always agree. It folds in
  // historical matches from History.jsx via the player_aliases map (plus a
  // first-name/full-name fallback), which is why veterans like Zornitsa see
  // real played/won/lost numbers here even if they've never been logged in
  // the Supabase `matches` table.
  const myStats = useMemo(() => {
    if (!claimedId) return null
    const base = buildPlayerStats(
      claimedId,
      matches,
      tournaments,
      registrations,
      players,
      playerAliases || {},
      LEGACY_TOURNAMENTS,
    )

    // Shape for the home card: short nemesis/best-partner rows.
    const nemesis =
      Object.entries(base.h2h)
        .filter(([, rec]) => rec.lost >= 1)
        .map(([oppId, rec]) => {
          const p = players.find((x) => x.id === oppId)
          return p ? { name: p.name.split(' ')[0], won: rec.won, lost: rec.lost } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.lost - b.won - (a.lost - a.won))[0] || null

    const bestPartner =
      Object.entries(base.partners)
        .filter(([, rec]) => rec.wins >= 1)
        .map(([pId, rec]) => {
          const p = players.find((x) => x.id === pId)
          return p ? { name: p.name.split(' ')[0], wins: rec.wins, games: rec.games } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.wins - a.wins)[0] || null

    // Attendance streak: consecutive completed tournaments the player
    // registered for. This is dashboard-specific (uses registrations, not
    // match rows) so it stays here rather than moving into playerStats.
    const completedSorted = tournaments
      .filter((t) => t.status === 'completed')
      .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))
    let streak = 0
    for (const t of completedSorted) {
      const tRegs = getTournamentRegistrations(t.id)
      if (tRegs.some((r) => r.playerId === claimedId && r.status === 'registered')) {
        streak++
      } else {
        break
      }
    }

    return {
      played: base.played,
      won: base.won,
      lost: base.lost,
      draws: base.draws,
      pts: base.points,
      pointsFor: base.pointsFor,
      pointsAgainst: base.pointsAgainst,
      winRate: base.winRate,
      streak,
      bestWinStreak: base.bestWinStreak,
      nemesis,
      bestPartner,
    }
  }, [
    claimedId,
    matches,
    tournaments,
    players,
    registrations,
    playerAliases,
    getTournamentRegistrations,
  ])

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const formatShortDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Greeting — members get the rotating "Snap snap, {name}!" set, guests
  // (no claimed player, no admin, no league admin) get a generic welcome
  // that invites them to sign in. Keeps the home page identical for
  // logged-in and logged-out visitors except for the top line.
  const isGuest = !claimedId && !isAdmin
  const [greetHello, greetSub] = isGuest
    ? ['Welcome to Padel Lobsters!', 'Sign in with your PIN to join the fun.']
    : getGreeting(claimedPlayer?.name || (isAdmin ? 'Admin' : null))

  // Tip of the day — use custom tips from settings or defaults
  // Launch-day tip overrides (date string → exact tip text)
  const TIP_OVERRIDES = {
    '2026-04-11':
      "Patience wins padel matches. Wait for the right ball to attack — don't force winners.",
    '2026-04-12':
      'Always return to the center of your side after every shot — positioning wins more points than power.',
  }
  const tips =
    settings?.padelTips && settings.padelTips.length > 0 ? settings.padelTips : DEFAULT_TIPS
  const todayTip = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (TIP_OVERRIDES[today]) return TIP_OVERRIDES[today]
    const now = new Date()
    const dayIndex = (now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate()) % tips.length
    return tips[dayIndex]
  }, [tips])

  return (
    <div className="space-y-5">
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

      <CountdownClock countdown={countdown} streak={myStats?.streak ?? 0} />

      <TipOfTheDay tip={todayTip} />

      <CommunityQuickLinks
        onNavigate={onNavigate}
        activePlayersCount={activePlayers.length}
        upcomingCount={upcomingCount}
        pastCount={pastCount}
        lastPodium={lastPodium}
      />

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

      <YourStatsCard claimedId={claimedId} myStats={myStats} onNavigate={onNavigate} />

      {/* Latest Updates section removed — the Updates feature is gone
          app-wide (see Layout / AppContext / Updates.jsx removal). */}

      <RecentResultsList
        pastTournaments={pastTournaments}
        getTournamentMatches={getTournamentMatches}
        getTournamentRegistrations={getTournamentRegistrations}
        players={players}
        onNavigate={onNavigate}
        formatShortDate={formatShortDate}
      />
    </div>
  )
}
