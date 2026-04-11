import React, { useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Trophy, Users, Calendar, ChevronRight, AlertCircle, Megaphone, TrendingUp, Clock, Flame, Award, Lightbulb, CreditCard, CalendarDays, ShoppingBag } from 'lucide-react'
import DEFAULT_TIPS from '../data/padelTips'
import { TOURNAMENTS as LEGACY_TOURNAMENTS } from './History'

const CLAW_IMG = '/claws.png'
const ClawUp = ({ active }) => (
  <img
    src={CLAW_IMG}
    alt="like"
    style={{
      width: 22, height: 22,
      objectFit: 'contain',
      display: 'block',
      flexShrink: 0,
      opacity: active ? 1 : 0.35,
      transition: 'opacity 0.15s, transform 0.15s',
      transform: active ? 'scale(1.2)' : 'scale(1)',
      filter: active ? 'drop-shadow(0 0 3px rgba(220,38,38,0.5))' : 'none',
    }}
  />
)
const ClawDown = ({ active }) => (
  <img
    src={CLAW_IMG}
    alt="dislike"
    style={{
      width: 22, height: 22,
      objectFit: 'contain',
      display: 'block',
      flexShrink: 0,
      transition: 'filter 0.15s, transform 0.15s',
      transform: active ? 'scale(1.2) rotate(180deg)' : 'scale(1) rotate(180deg)',
      filter: active ? 'grayscale(1) brightness(0.45)' : 'grayscale(1) brightness(1.6)',
    }}
  />
)

// ── Fun greetings ────────────────────────────────────────────────────────────
const GREETINGS_HELLO = [
  (n) => [`Hey, ${n}!`, `Ready to pinch some wins?`],
  (n) => [`${n}!`, `The court is calling — time to play.`],
  (n) => [`Ahoy, ${n}!`, `Time to shell-ebrate some padel.`],
  (n) => [`${n}!`, `Today's forecast: 100% chance of lobster tears.`],
  (n) => [`Welcome back, ${n}!`, `May your lobs be high and your opponents low.`],
  (n) => [`${n}!`, `Time to lob some lobsters.`],
  (n) => [`Snap snap, ${n}!`, `Let's get on the court.`],
  (n) => [`${n}!`, `The lobsters are restless. Show them who's boss.`],
  (n) => [`¡Vamos, ${n}!`, `Menos bla bla, más padel.`],
]

// Launch-day greeting overrides (date string → index into GREETINGS_HELLO)
const GREETING_OVERRIDES = {
  '2026-04-11': 6, // "Snap snap, {name}! Let's get on the court."
  '2026-04-12': 8, // "¡Vamos, {name}! Menos bla bla, más padel."
}

function getGreeting(name) {
  const first = (name || 'Lobster').split(' ')[0]
  const today = new Date().toISOString().slice(0, 10)
  if (GREETING_OVERRIDES[today] !== undefined) {
    return GREETINGS_HELLO[GREETING_OVERRIDES[today]](first)
  }
  const dayHash = new Date().getDate() + first.charCodeAt(0)
  return GREETINGS_HELLO[dayHash % GREETINGS_HELLO.length](first)
}

// ── Live countdown hook (ticks every second) ────────────────────────────────
function useCountdown(dateStr) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!dateStr) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [dateStr])

  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - now
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return { days, hours, mins, secs }
}

export default function Dashboard({ onNavigate }) {
  const {
    tournaments, players, updates, registrations, matches, settings,
    getTournamentRegistrations, getTournamentMatches,
    isAdmin, claimedId, getPlayerById,
  } = useApp()

  const claimedPlayer = claimedId ? getPlayerById(claimedId) : null
  const activePlayers = players.filter(p => (p.status || 'active') === 'active')
  const recentUpdates = (updates || []).slice(0, 2)

  // ── New merch orders since last admin check ─────────────────────────────────
  const [newOrders, setNewOrders] = useState([])
  const LAST_CHECK_KEY = 'pl_merch_last_checked'

  useEffect(() => {
    if (!isAdmin) return
    const loadNewOrders = async () => {
      const lastChecked = localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString()
      const [ordersRes, itemsRes] = await Promise.all([
        supabase.from('merch_interests').select('*, players(name)').gte('created_at', lastChecked).order('created_at', { ascending: false }).limit(20),
        supabase.from('merch_items').select('id, name').eq('active', true),
      ])
      const orders = ordersRes.data || []
      const itemMap = Object.fromEntries((itemsRes.data || []).map(i => [i.id, i.name]))
      setNewOrders(orders.map(o => ({ ...o, itemName: itemMap[o.merch_item_id] || 'item' })))
    }
    loadNewOrders()
    const ch = supabase.channel('dash-merch-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'merch_interests' }, loadNewOrders)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [isAdmin])

  const dismissMerchOrders = () => {
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())
    setNewOrders([])
  }

  const formatUpdateTime = (ts) => {
    if (!ts) return ''
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60)    return 'just now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Recently completed tournaments (within 48 hours of tournament date)
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
  const recentlyCompleted = tournaments.filter(t => {
    if (t.status !== 'completed') return false
    const refDate = t.date || t.completedAt
    if (!refDate) return false
    return Date.now() - new Date(refDate).getTime() < TWO_DAYS_MS
  }).sort((a, b) => new Date(b.date || b.completedAt) - new Date(a.date || a.completedAt))

  // Next upcoming tournament
  const upcoming = tournaments
    .filter(t => t.status === 'upcoming' || t.status === 'active')
    .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1)[0]

  const regs = upcoming ? getTournamentRegistrations(upcoming.id) : []
  const registered = regs.filter(r => r.status === 'registered')
  const waitlisted = regs.filter(r => r.status === 'waitlist')
  const unpaid     = regs.filter(r => r.status === 'registered' && r.paymentStatus !== 'paid')

  const isRegistered = upcoming && claimedId
    ? regs.some(r => r.playerId === claimedId && r.status === 'registered')
    : false

  // Live countdown
  const countdown = useCountdown(upcoming?.date)

  // Past completed tournaments for history section
  const pastTournaments = tournaments
    .filter(t => t.status === 'completed')
    .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)
    .slice(0, 6)

  // Community stats
  const upcomingCount = tournaments.filter(t => t.status === 'upcoming' || t.status === 'active').length
  const pastCount = tournaments.filter(t => t.status === 'completed').length + LEGACY_TOURNAMENTS.length

  // Top 3 from the last completed tournament
  const lastPodium = useMemo(() => {
    const lastCompleted = tournaments
      .filter(t => t.status === 'completed')
      .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)[0]
    if (!lastCompleted) return null
    const tRegs = getTournamentRegistrations(lastCompleted.id).filter(r => r.status === 'registered')
    const tMatches = getTournamentMatches(lastCompleted.id)
    if (tMatches.length === 0) return null
    const stats = {}
    tRegs.forEach(r => { stats[r.playerId] = { pts: 0, won: 0 } })
    tMatches.filter(m => m.completed && m.score1 != null).forEach(m => {
      const s1 = parseInt(m.score1) || 0, s2 = parseInt(m.score2) || 0
      ;(m.team1Ids || []).forEach(id => { if (stats[id]) { stats[id].pts += s1; if (s1 > s2) stats[id].won++ } })
      ;(m.team2Ids || []).forEach(id => { if (stats[id]) { stats[id].pts += s2; if (s2 > s1) stats[id].won++ } })
    })
    return Object.entries(stats)
      .sort((a, b) => b[1].pts !== a[1].pts ? b[1].pts - a[1].pts : b[1].won - a[1].won)
      .slice(0, 3)
      .map(([id]) => players.find(p => p.id === id))
      .filter(Boolean)
      .map(p => p.name.split(' ')[0])
  }, [tournaments, matches, players, getTournamentRegistrations, getTournamentMatches])

  // ── Personal stats for claimed player ──────────────────────────────────────
  const myStats = useMemo(() => {
    if (!claimedId) return null
    let played = 0, won = 0, lost = 0, draws = 0, pts = 0, pointsFor = 0, pointsAgainst = 0
    const h2h = {} // opponentId → { won, lost }
    const partners = {} // partnerId → { wins, games }
    let bestWinStreak = 0, curWinStreak = 0

    matches.filter(m => m.completed).forEach(m => {
      const onT1 = (m.team1Ids || []).includes(claimedId)
      const onT2 = (m.team2Ids || []).includes(claimedId)
      if (!onT1 && !onT2) return
      played++
      const s1 = parseInt(m.score1) || 0, s2 = parseInt(m.score2) || 0
      if (onT1) { pointsFor += s1; pointsAgainst += s2 }
      else      { pointsFor += s2; pointsAgainst += s1 }
      const t1w = s1 > s2, t2w = s2 > s1
      const iWon = (onT1 && t1w) || (onT2 && t2w)
      const iLost = (onT1 && t2w) || (onT2 && t1w)
      pts = pointsFor  // total game points scored
      if (iWon) { won++; curWinStreak++; bestWinStreak = Math.max(bestWinStreak, curWinStreak) }
      else if (s1 === s2) { draws++; curWinStreak = 0 }
      else { lost++; curWinStreak = 0 }

      // Track head-to-head
      const opponents = onT1 ? (m.team2Ids || []) : (m.team1Ids || [])
      opponents.forEach(oppId => {
        if (!h2h[oppId]) h2h[oppId] = { won: 0, lost: 0 }
        if (iWon) h2h[oppId].won++
        else if (iLost) h2h[oppId].lost++
      })

      // Track partners (teammates)
      const teammates = onT1 ? (m.team1Ids || []) : (m.team2Ids || [])
      teammates.forEach(tId => {
        if (tId === claimedId) return
        if (!partners[tId]) partners[tId] = { wins: 0, games: 0 }
        partners[tId].games++
        if (iWon) partners[tId].wins++
      })
    })
    if (played === 0) return null

    // Top nemesis: opponent you've lost to the most (min 2 games)
    const nemesis = Object.entries(h2h)
      .filter(([, rec]) => (rec.won + rec.lost) >= 2 && rec.lost > 0)
      .map(([oppId, rec]) => {
        const p = players.find(x => x.id === oppId)
        return p ? { name: p.name.split(' ')[0], won: rec.won, lost: rec.lost } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.lost - a.lost)[0] || null

    // Best partner: teammate you've won the most with (min 2 games together)
    const bestPartner = Object.entries(partners)
      .filter(([, rec]) => rec.games >= 2 && rec.wins > 0)
      .map(([pId, rec]) => {
        const p = players.find(x => x.id === pId)
        return p ? { name: p.name.split(' ')[0], wins: rec.wins, games: rec.games } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.wins - a.wins)[0] || null

    // Attendance streak: consecutive completed tournaments the player participated in
    const completedSorted = tournaments
      .filter(t => t.status === 'completed')
      .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)
    let streak = 0
    for (const t of completedSorted) {
      const tRegs = getTournamentRegistrations(t.id)
      if (tRegs.some(r => r.playerId === claimedId && r.status === 'registered')) {
        streak++
      } else {
        break
      }
    }

    const winRate = played > 0 ? Math.round((won / played) * 100) : 0
    return { played, won, lost, draws, pts, pointsFor, pointsAgainst, winRate, streak, bestWinStreak, nemesis, bestPartner }
  }, [claimedId, matches, tournaments, players, getTournamentRegistrations])

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const formatShortDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const [greetHello, greetSub] = getGreeting(claimedPlayer?.name || (isAdmin ? 'Admin' : null))

  // Tip of the day — use custom tips from settings or defaults
  // Launch-day tip overrides (date string → exact tip text)
  const TIP_OVERRIDES = {
    '2026-04-11': "Patience wins padel matches. Wait for the right ball to attack — don't force winners.",
    '2026-04-12': "Always return to the center of your side after every shot — positioning wins more points than power.",
  }
  const tips = (settings?.padelTips && settings.padelTips.length > 0) ? settings.padelTips : DEFAULT_TIPS
  const todayTip = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (TIP_OVERRIDES[today]) return TIP_OVERRIDES[today]
    const now = new Date()
    const dayIndex = (now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate()) % tips.length
    return tips[dayIndex]
  }, [tips])

  return (
    <div className="space-y-5">

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div>
        <p className="text-xl font-extrabold text-gray-800 leading-snug">{greetHello}</p>
        <p className="text-base text-gray-500 mt-0.5">{greetSub}</p>
      </div>

      {/* ── Countdown flip clock + streak ──────────────────────── */}
      {countdown && (
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Next Lobster Event in</p>
          <div className="flex justify-center gap-2">
            <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
              <p className="text-2xl font-black text-white tabular-nums">{String(countdown.days).padStart(2,'0')}</p>
              <p className="text-[9px] text-white/60 font-medium mt-0.5">DAYS</p>
            </div>
            <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
              <p className="text-2xl font-black text-white tabular-nums">{String(countdown.hours).padStart(2,'0')}</p>
              <p className="text-[9px] text-white/60 font-medium mt-0.5">HOURS</p>
            </div>
            <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
              <p className="text-2xl font-black text-white tabular-nums">{String(countdown.mins).padStart(2,'0')}</p>
              <p className="text-[9px] text-white/60 font-medium mt-0.5">MIN</p>
            </div>
            <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
              <p className="text-2xl font-black text-white tabular-nums">{String(countdown.secs).padStart(2,'0')}</p>
              <p className="text-[9px] text-white/60 font-medium mt-0.5">SEC</p>
            </div>
          </div>
          {myStats?.streak > 0 && (
            <p className="text-[11px] text-gray-500 font-semibold mt-2 flex items-center justify-center gap-1">
              <Flame size={13} className="text-orange-500" />
              {myStats.streak} event{myStats.streak > 1 ? 's' : ''} in a row
            </p>
          )}
        </div>
      )}
      {!countdown && myStats?.streak > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
            <Flame size={13} className="text-orange-500" />
            {myStats.streak} event{myStats.streak > 1 ? 's' : ''} in a row
          </span>
        </div>
      )}

      {/* ── Tip of the Day ──────────────────────────────────────── */}
      {todayTip && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lightbulb size={17} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">Tip of the Day</p>
            <p className="text-sm text-gray-700 leading-relaxed">{todayTip}</p>
            <p className="text-xs text-gray-400 italic mt-1.5">– ask Jon for more tips</p>
          </div>
        </div>
      )}

      {/* ── Community quick links ─────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => onNavigate('players')} className="bg-white rounded-2xl py-3 text-center shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all">
          <Users size={16} className="text-lobster-teal mx-auto mb-1" />
          <p className="text-base font-bold text-gray-800">{activePlayers.length}</p>
          <p className="text-[9px] text-gray-400 font-medium">Players</p>
        </button>
        <button onClick={() => onNavigate('tournament')} className="bg-white rounded-2xl py-3 text-center shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all">
          <Calendar size={16} className="text-lobster-orange mx-auto mb-1" />
          <p className="text-base font-bold text-gray-800">{upcomingCount}</p>
          <p className="text-[9px] text-gray-400 font-medium">Upcoming</p>
        </button>
        <button onClick={() => onNavigate('history')} className="bg-white rounded-2xl py-3 text-center shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all">
          <Trophy size={16} className="text-yellow-500 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-800">{pastCount}</p>
          <p className="text-[9px] text-gray-400 font-medium">Past</p>
        </button>
        <button onClick={() => onNavigate('history')} className="bg-white rounded-2xl py-3 shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all">
          <Award size={16} className="text-yellow-500 mx-auto mb-1" />
          {lastPodium && lastPodium.length > 0 ? (
            <div className="px-1">
              {lastPodium.map((name, i) => (
                <p key={i} className="text-[9px] font-bold text-gray-700 truncate leading-tight text-left">
                  {['🥇','🥈','🥉'][i]} {name}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-base font-bold text-gray-300">—</p>
          )}
        </button>
      </div>

      {/* ── Next event — glass card ───────────────────────────── */}
      {upcoming ? (
        <div
          className="rounded-2xl p-4 shadow-sm bg-white/80 border border-white/90"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <p className="text-[10px] font-bold text-lobster-orange uppercase tracking-wide mb-1">Your Next Event</p>
          <h2 className="text-base font-bold text-gray-800">
            <button onClick={() => onNavigate('registration', upcoming)} className="hover:text-lobster-teal active:scale-95 transition-all text-left">
              {upcoming.name}
            </button>
          </h2>
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(upcoming.date)}
          </p>

          {/* Registration status badge */}
          {claimedId && (
            isRegistered ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 mb-3">
                <span className="text-green-600 text-xs">✓</span>
                <span className="text-xs font-semibold text-green-700">You're registered!</span>
              </div>
            ) : !isAdmin ? (
              <button
                onClick={() => onNavigate('registration', upcoming)}
                className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 mb-3 active:scale-95 transition-all"
              >
                <span className="text-orange-500 text-xs">!</span>
                <span className="text-xs font-semibold text-orange-700">Not signed up yet — tap to join</span>
              </button>
            ) : null
          )}

          {/* Action links */}
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('registration', upcoming)}
              className="flex-1 bg-lobster-orange text-white font-semibold py-2 rounded-xl text-xs active:scale-95 transition-all"
            >
              Registrations
            </button>
            <button
              onClick={() => onNavigate('schedule', upcoming)}
              className="flex-none bg-gray-100 text-gray-600 font-semibold py-1.5 px-3 rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1"
            >
              <CalendarDays size={12} /> Schedule
            </button>
            {isAdmin && (
              <button
                onClick={() => onNavigate('payments', upcoming)}
                className="flex-none bg-gray-100 text-gray-600 font-semibold py-1.5 px-3 rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1"
              >
                <CreditCard size={12} /> Payments
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center py-8 text-center gap-2">
          <Calendar size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">No upcoming events right now</p>
          <p className="text-xs text-gray-400">Check back soon — next tournament is around the corner.</p>
          {isAdmin && (
            <button onClick={() => onNavigate('tournament')} className="btn-primary text-sm py-2 px-4 mt-2">
              Create an Event
            </button>
          )}
        </div>
      )}

      {/* ── Recently completed — see results ──────────────────── */}
      {recentlyCompleted.map(t => {
        const tMatches  = getTournamentMatches(t.id)
        const tRegs     = getTournamentRegistrations(t.id).filter(r => r.status === 'registered')
        const stats = {}
        tRegs.forEach(r => { stats[r.playerId] = { pts: 0, won: 0 } })
        tMatches.filter(m => m.completed && m.score1 != null).forEach(m => {
          const s1 = parseInt(m.score1) || 0, s2 = parseInt(m.score2) || 0
          ;(m.team1Ids || []).forEach(id => { if (stats[id]) { stats[id].pts += s1; if (s1 > s2) stats[id].won++ } })
          ;(m.team2Ids || []).forEach(id => { if (stats[id]) { stats[id].pts += s2; if (s2 > s1) stats[id].won++ } })
        })
        const sorted = tRegs
          .map(r => ({ ...r, pts: stats[r.playerId]?.pts ?? 0, won: stats[r.playerId]?.won ?? 0, player: players.find(p => p.id === r.playerId) }))
          .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.won - a.won)
        const winner = sorted[0]?.player

        return (
          <div key={t.id} className="bg-gradient-to-r from-yellow-400 to-lobster-orange rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏆</span>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">Tournament Complete!</p>
            </div>
            <h3 className="font-bold text-base mb-0.5">{t.name}</h3>
            {winner && (
              <p className="text-sm opacity-90 mb-3">
                🥇 Winner: <span className="font-bold">{winner.name}</span>
              </p>
            )}
            <button
              onClick={() => onNavigate('scores', t)}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              See Full Results
            </button>
          </div>
        )
      })}

      {/* ── Admin alerts ──────────────────────────────────────── */}
      {isAdmin && unpaid.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {unpaid.length} player{unpaid.length > 1 ? 's' : ''} haven't paid yet
          </p>
          <button onClick={() => onNavigate('payments', upcoming)} className="ml-auto text-xs text-red-600 font-semibold">
            View
          </button>
        </div>
      )}

      {/* ── Birthday alerts (admin) ───────────────────────────── */}
      {isAdmin && (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const upcoming7 = players
          .filter(p => p.birthday)
          .map(p => {
            const d = new Date(p.birthday)
            let bday = new Date(today.getFullYear(), d.getMonth(), d.getDate())
            if (bday < today) bday = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
            const diff = Math.round((bday - today) / 86400000)
            return { p, diff }
          })
          .filter(({ diff }) => diff <= 7)
          .sort((a, b) => a.diff - b.diff)

        if (upcoming7.length === 0) return null
        return (
          <div className="card border-l-4 border-pink-300 bg-pink-50/40 space-y-2">
            <p className="font-bold text-sm text-pink-700">🎂 Upcoming Birthdays</p>
            {upcoming7.map(({ p, diff }) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-base">{diff === 0 ? '🎉' : '🎂'}</span>
                <span className="text-sm font-semibold text-gray-700">{p.name.split(' ')[0]}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {diff === 0 ? 'Today! 🎈' : diff === 1 ? 'Tomorrow' : `In ${diff} days`}
                </span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── New merch orders (admin) ─────────────────────────── */}
      {isAdmin && newOrders.length > 0 && (
        <div className="card border-l-4 border-lobster-teal space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-gray-700 flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-lobster-teal" /> New Merch Orders
              <span className="bg-lobster-teal text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{newOrders.length}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => { dismissMerchOrders(); onNavigate('merch-orders') }} className="text-xs text-lobster-teal font-semibold">
                View all
              </button>
              <button onClick={dismissMerchOrders} className="text-xs text-gray-400 font-medium">
                Dismiss
              </button>
            </div>
          </div>
          {newOrders.slice(0, 5).map(o => {
            const playerName = o.players?.name?.split(' ')[0] || 'Someone'
            const itemName = o.itemName || 'item'
            const ago = formatUpdateTime(o.created_at)
            return (
              <div key={o.id} className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-lobster-cream flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={12} className="text-lobster-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 truncate">
                    <span className="font-semibold">{playerName}</span> ordered <span className="font-medium">{itemName}</span>
                    {o.size && <span className="text-gray-400"> · {o.size}</span>}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{ago}</span>
              </div>
            )
          })}
          {newOrders.length > 5 && (
            <p className="text-xs text-gray-400 text-center">+{newOrders.length - 5} more</p>
          )}
        </div>
      )}

      {/* ── Your Stats (personal) ─────────────────────────────── */}
      {myStats && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
              <Award size={15} className="text-lobster-orange" /> Your Stats
            </h3>
            <button onClick={() => onNavigate('players', { focusPlayerId: claimedId })} className="text-xs text-lobster-teal font-semibold">
              View profile
            </button>
          </div>
          <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-white/90" style={{ backdropFilter: 'blur(12px)' }}>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-gray-800">{myStats.played}</p>
                <p className="text-[9px] text-gray-400 font-medium">Played</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{myStats.won}</p>
                <p className="text-[9px] text-gray-400 font-medium">Won</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">{myStats.lost}</p>
                <p className="text-[9px] text-gray-400 font-medium">Lost</p>
              </div>
              <div>
                <p className="text-lg font-bold text-lobster-orange">{myStats.winRate}%</p>
                <p className="text-[9px] text-gray-400 font-medium">Win Rate</p>
              </div>
            </div>

            {/* Best win streak + Nemesis + Best partner row */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
              {myStats.bestWinStreak > 1 && (
                <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                  <Flame size={12} className="text-green-500" />
                  {myStats.bestWinStreak} wins in a row
                </span>
              )}
              {myStats.nemesis && (
                <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-semibold">
                  😈 Nemesis: {myStats.nemesis.name} ({myStats.nemesis.won}W-{myStats.nemesis.lost}L)
                </span>
              )}
              {myStats.bestPartner && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-semibold">
                  🤝 Best partner: {myStats.bestPartner.name} ({myStats.bestPartner.wins}W/{myStats.bestPartner.games}G)
                </span>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{myStats.pts} total points</span>
              <span>Game diff: {myStats.pointsFor - myStats.pointsAgainst > 0 ? '+' : ''}{myStats.pointsFor - myStats.pointsAgainst}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Latest updates ────────────────────────────────────── */}
      {recentUpdates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
              <Megaphone size={15} className="text-lobster-orange" /> Latest Updates
            </h3>
            <button onClick={() => onNavigate('updates')} className="text-xs text-lobster-teal font-semibold">
              See all
            </button>
          </div>
          <div className="space-y-2">
            {recentUpdates.map(u => {
              const poster = players.find(p => String(p.id) === String(u.player_id))
              const ups    = (u.update_reactions || []).filter(r => r.type === 'up').length
              const downs  = (u.update_reactions || []).filter(r => r.type === 'down').length
              return (
                <button
                  key={u.id}
                  onClick={() => onNavigate('updates')}
                  className="card w-full text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {(poster?.name || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{poster?.name || 'Unknown'}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{formatUpdateTime(u.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{u.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1"><ClawUp /> <span className="text-xs text-gray-400">{ups || ''}</span></span>
                    <span className="flex items-center gap-1"><ClawDown /> <span className="text-xs text-gray-400">{downs || ''}</span></span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Event history ─────────────────────────────────────── */}
      {pastTournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
              <Trophy size={15} className="text-yellow-500" /> Past Events
            </h3>
            <button onClick={() => onNavigate('history')} className="text-xs text-lobster-teal font-semibold">
              Full history
            </button>
          </div>
          <div className="space-y-2">
            {pastTournaments.map(t => {
              const tMatches = getTournamentMatches(t.id)
              const tRegs = getTournamentRegistrations(t.id).filter(r => r.status === 'registered')
              const stats = {}
              tRegs.forEach(r => { stats[r.playerId] = { pts: 0, won: 0 } })
              tMatches.filter(m => m.completed && m.score1 != null).forEach(m => {
                const s1 = parseInt(m.score1) || 0, s2 = parseInt(m.score2) || 0
                ;(m.team1Ids || []).forEach(id => { if (stats[id]) { stats[id].pts += s1; if (s1 > s2) stats[id].won++ } })
                ;(m.team2Ids || []).forEach(id => { if (stats[id]) { stats[id].pts += s2; if (s2 > s1) stats[id].won++ } })
              })
              const winner = tRegs
                .map(r => ({ pts: stats[r.playerId]?.pts ?? 0, won: stats[r.playerId]?.won ?? 0, player: players.find(p => p.id === r.playerId) }))
                .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.won - a.won)[0]?.player

              return (
                <button
                  key={t.id}
                  onClick={() => onNavigate('scores', t)}
                  className="card w-full flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                  <div className="w-9 h-9 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Trophy size={16} className="text-yellow-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatShortDate(t.date)}
                      {tRegs.length > 0 ? ` · ${tRegs.length} players` : ''}
                      {winner ? ` · 🥇 ${winner.name.split(' ')[0]}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
