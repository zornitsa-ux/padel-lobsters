import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import {
  UserCheck, UserX, Clock, ChevronLeft, Search,
  Plus, X, AlertCircle, CheckCircle, Users, ExternalLink,
  UserCog, ArrowRightLeft, Send, Pencil, Check
} from 'lucide-react'
import { SignInBanner } from './AuthGate'
import { DateTile, AddToCalendarButton, ShareWhatsAppButton } from './CalendarPieces'
import { fmtEur } from '../lib/format'

// Tournaments stay on the home page for 48h after their date; during that
// window we show "🏆 Lobster Games Over — See Results!" if a game was played.
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

export default function Registration({ tournament, onNavigate }) {
  const {
    players, registrations, registerPlayer, cancelRegistration,
    updateRegistration, transferRegistration,
    getTournamentRegistrations, getTournamentMatches, updateMatch, updateTournament,
    isAdmin, claimedId
  } = useApp()

  // Show first name for players, full name for admins
  const displayName = (p) => isAdmin ? p.name : (p.name || '').split(' ')[0]

  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [saving, setSaving]         = useState(false)

  // Post-registration payment sheet
  const [paymentSheet, setPaymentSheet] = useState(null)  // { regId, playerId, status }
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring]         = useState(false)

  const [marking, setMarking] = useState(false)

  // Whether a Lobster Oscars session has been shared for this tournament.
  // Drives the "Lobster Games Over — See Results!" banner during the 48h window.
  const [hasGameResults, setHasGameResults] = useState(false)
  useEffect(() => {
    if (!tournament?.id) return
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('lobster_oscars_sessions')
        .select('shared_at')
        .eq('tournament_id', tournament.id)
        .maybeSingle()
      if (active) setHasGameResults(!!data?.shared_at)
    })()
    return () => { active = false }
  }, [tournament?.id])
  const withinRecentWindow = (() => {
    if (!tournament?.date) return false
    const refMs = new Date(tournament.date).getTime()
    if (Number.isNaN(refMs)) return false
    const elapsed = Date.now() - refMs
    // Show the banner from the day of the tournament up to 48h after
    return elapsed >= -TWO_DAYS_MS && elapsed < TWO_DAYS_MS
  })()
  const showResultsBanner = hasGameResults && withinRecentWindow

  const openPaymentSheet = (sheet) => { setPaymentSheet(sheet); setTikkieClicked(false) }
  const closePaymentSheet = () => { setPaymentSheet(null); setTikkieClicked(false) }

  // Transfer sheet
  const [transferSheet, setTransferSheet] = useState(null) // { reg }
  const [transferSearch, setTransferSearch] = useState('')
  const [transferring, setTransferring]     = useState(false)

  if (!tournament) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
        <p>No event selected</p>
        <button onClick={() => onNavigate('tournament')} className="btn-primary mt-4 py-2 px-5 text-sm">
          Go to Events
        </button>
      </div>
    )
  }

  const regs = getTournamentRegistrations(tournament.id)
  const registered = regs.filter(r => r.status === 'registered')
    .sort((a, b) => (a.registeredAt?.seconds || 0) - (b.registeredAt?.seconds || 0))
  const waitlisted = regs.filter(r => r.status === 'waitlist')
    .sort((a, b) => (a.registeredAt?.seconds || 0) - (b.registeredAt?.seconds || 0))
  const cancelled  = regs.filter(r => r.status === 'cancelled')

  // Ids that currently hold a spot (can't be registered again, can't receive a transfer).
  const registeredIds = regs.filter(r => r.status === 'registered').map(r => r.playerId)
  // Ids on the waitlist — they SHOULD appear as transfer targets (receiving a
  // transfer promotes them into the open spot) but still shouldn't appear in
  // the generic "add player" picker since they're already in the tournament.
  const waitlistedIds = regs.filter(r => r.status === 'waitlist').map(r => r.playerId)
  const inTournamentIds = [...registeredIds, ...waitlistedIds]
  const availablePlayers = players
    .filter(p => (p.status || 'active') === 'active')
    .filter(p => !inTournamentIds.includes(p.id) &&
      (p.name?.toLowerCase().includes(search.toLowerCase()) || !search)
    )

  const maxPlayers = tournament.maxPlayers || 16
  const isCompleted = tournament.status === 'completed'
  // Completed tournaments show a Ranking ↔ Matches tab switcher instead of
  // the registered / waitlist / cancelled player lists. Default to Ranking.
  const [completedTab, setCompletedTab] = useState('ranking')
  const isAdminAll = !tournament.courtBookingMode || tournament.courtBookingMode === 'admin_all'
  const hasTikkie  = isAdminAll
    ? !!tournament.tikkieLink
    : (tournament.courts || []).some(c => c.tikkieLink)
  const costPerPlayer = isAdminAll
    ? (tournament.totalPrice > 0 ? tournament.totalPrice / (tournament.maxPlayers || 1) : 0)
    : (tournament.courts || []).reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0)

  const getPlayer = (id) => players.find(p => p.id === id)

  // ── Register ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!selectedPlayer) return
    setSaving(true)
    try {
      const { regId, status } = await registerPlayer(tournament.id, selectedPlayer, maxPlayers)
      // Only show payment sheet for directly-registered players (not waitlist),
      // and only if there's a Tikkie link or a cost set
      if (status === 'registered' && (hasTikkie || costPerPlayer > 0)) {
        openPaymentSheet({ regId, playerId: selectedPlayer, status })
      }
      setSelectedPlayer(''); setShowAdd(false); setSearch('')
    } finally { setSaving(false) }
  }

  // ── Self-declare payment ──────────────────────────────────────────────────
  const handleSelfDeclare = async () => {
    if (!paymentSheet?.regId) return
    setDeclaring(true)
    await updateRegistration(paymentSheet.regId, {
      paymentStatus: 'pending_confirmation',
      paymentMethod: 'tikkie',
    })
    setDeclaring(false)
    closePaymentSheet()
  }

  // ── Auto-mark "Tikkied" when a player taps a Tikkie link ──────────────────
  // Only upgrades from unpaid → tikkied. Never downgrades someone who already
  // self-declared "paid" or whom the admin already confirmed — even if they
  // re-open the Tikkie link (e.g. to check their payment history).
  const markTikkied = async (regId, currentStatus) => {
    if (!regId) return
    if (currentStatus && currentStatus !== 'unpaid') return
    try {
      await updateRegistration(regId, {
        paymentStatus: 'tikkied',
        paymentMethod: 'tikkie',
      })
    } catch (err) {
      // Non-blocking — the Tikkie link still opens even if the status update
      // fails. Admin can always fix the status manually.
      console.warn('markTikkied failed', err)
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async (reg) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    if (!confirm(`Cancel ${getPlayer(reg.playerId)?.name}'s registration?`)) return
    await cancelRegistration(reg.id, tournament.id)
  }

  const handleMoveToRegistered = async (reg) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    await updateRegistration(reg.id, { status: 'registered' })
  }

  // ── Transfer ──────────────────────────────────────────────────────────────
  const handleTransferConfirm = async (toPlayer) => {
    if (!transferSheet) return
    setTransferring(true)
    await transferRegistration(
      transferSheet.reg.id,
      tournament.id,
      transferSheet.reg.playerId,
      toPlayer.id
    )
    setTransferring(false)
    setTransferSheet(null)
    setTransferSearch('')
  }

  // Transfer candidates: active players who don't already hold a registered
  // spot in this tournament. Waitlisted players ARE eligible — in fact,
  // transferring to a waitlister is the most natural thing to do, because
  // it promotes them from the waitlist into the open spot in one step.
  // We surface them at the top with a "Waitlisted" hint so it's clear.
  const transferCandidates = players
    .filter(p => (p.status || 'active') === 'active')
    .filter(p => String(p.id) !== String(transferSheet?.reg?.playerId))
    .filter(p => !registeredIds.includes(p.id))
    .filter(p => !transferSearch || p.name.toLowerCase().includes(transferSearch.toLowerCase()))
    .sort((a, b) => {
      const aw = waitlistedIds.includes(a.id) ? 0 : 1
      const bw = waitlistedIds.includes(b.id) ? 0 : 1
      if (aw !== bw) return aw - bw
      return (a.name || '').localeCompare(b.name || '')
    })

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Payment status badge helper.
  // Status values and what they mean to the admin:
  //   - 'unpaid'                → player hasn't tapped anything yet
  //   - 'tikkied'               → player tapped the Tikkie link (amber)
  //   - 'pending_confirmation'  → player self-declared "I've sent payment"
  //                               (shown as "Paid" — still awaits admin check)
  //   - 'paid'                  → admin confirmed the bank transfer
  //   - 'transferred'           → player transferred their spot to someone else
  const PayBadge = ({ reg }) => {
    const ps = reg.paymentStatus
    if (ps === 'paid')                  return <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Confirmed ✓</span>
    if (ps === 'transferred')           return <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Transferred</span>
    if (ps === 'pending_confirmation')  return <span className="text-xs font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Paid</span>
    if (ps === 'tikkied')               return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Tikkied</span>
    return <span className="badge-unpaid">Unpaid</span>
  }

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <div className="mt-2 flex items-center gap-3">
          <DateTile date={tournament.date} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-800 leading-tight">
              {formatDate(tournament.date)}
            </p>
            {tournament.time && (
              <p className="text-sm text-gray-500 leading-tight mt-0.5">
                {tournament.time}
                {tournament.duration ? ` · ${tournament.duration}min` : ''}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <ShareWhatsAppButton tournament={tournament} variant="icon" />
            <AddToCalendarButton tournament={tournament} variant="icon" />
          </div>
        </div>

        {/* Event description — read-only for players, inline-editable for
            admins (click the pencil → textarea with Save / Cancel). */}
        <EventDescription
          tournament={tournament}
          isAdmin={isAdmin}
          onSave={(next) => updateTournament(tournament.id, { notes: next })}
        />
      </div>

      {/* Summary bar */}
      <div className="bg-lobster-teal rounded-xl p-4 text-white flex items-center justify-between">
        <div className="text-center">
          <p className="text-2xl font-bold">{registered.length}</p>
          <p className="text-xs opacity-75">Registered</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${waitlisted.length > 0 ? 'text-lobster-gold' : ''}`}>{waitlisted.length}</p>
          <p className="text-xs opacity-75">Waitlist</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{maxPlayers}</p>
          <p className="text-xs opacity-75">Max players</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${registered.length >= maxPlayers ? 'text-lobster-gold' : 'text-green-300'}`}>
            {Math.max(0, maxPlayers - registered.length)}
          </p>
          <p className="text-xs opacity-75">Spots left</p>
        </div>
      </div>


      {/* Lobster Games Over — results banner (visible for the 48h window) */}
      {showResultsBanner && (
        <button
          onClick={() => onNavigate('game', tournament)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 text-gray-900 font-bold text-sm shadow-md active:scale-95 transition-all"
        >
          🏆 Lobster Games Over — See Results!
        </button>
      )}

      {/* Game button — hidden once the tournament is completed, since the
          results live on the Scores page as a Lobster Games tab. */}
      {!isCompleted && (
        <button
          onClick={() => onNavigate('game', tournament)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-violet-400 text-white font-semibold text-sm shadow"
        >
          🎮 Lobster Games
        </button>
      )}

      {/* Add player — hidden for completed tournaments */}
      {isCompleted ? null : !showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Register a Player
        </button>
      ) : (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-700">Select Player</p>
            <button onClick={() => { setShowAdd(false); setSearch('') }}>
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 py-2 text-sm" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {availablePlayers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-3">All players already registered</p>
            )}
            {availablePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(selectedPlayer === p.id ? '' : p.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                  selectedPlayer === p.id ? 'bg-lobster-teal text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  selectedPlayer === p.id ? 'bg-white text-lobster-teal' : 'bg-lobster-teal text-white'
                }`}>
                  {(p.name || '?')[0]}
                </div>
                <span className="flex-1 text-left font-medium text-sm">{displayName(p)}</span>
                <span className={`text-xs font-bold ${selectedPlayer === p.id ? 'text-white' : 'text-gray-500'}`}>
                  Lv {(p.adjustedLevel || 0).toFixed(1)}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd} disabled={!selectedPlayer || saving}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {saving ? 'Adding...' : registered.length >= maxPlayers ? 'Add to Waitlist' : 'Register Player'}
          </button>
        </div>
      )}

      {/* Registered players — hidden for completed tournaments (replaced by
          the Ranking / Matches tab switcher further down). */}
      {!isCompleted && (
      <section>
        <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500" />
          Registered ({registered.length}/{maxPlayers})
        </h3>
        <div className="space-y-2">
          {registered.length === 0 && (
            <p className="text-sm text-gray-400 card py-4 text-center">No players registered yet</p>
          )}
          {registered.map((reg, idx) => {
            const p = getPlayer(reg.playerId)
            if (!p) return null
            const isMyReg   = claimedId && String(claimedId) === String(reg.playerId)
            const canTransfer = isAdmin || isMyReg
            return (
              <div key={reg.id} className="card space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-center font-bold">#{idx + 1}</span>
                  <div className="w-9 h-9 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{displayName(p)}</p>
                    <p className="text-xs text-gray-400">Level {(p.adjustedLevel || 0).toFixed(1)}</p>
                  </div>
                  {/* Payment badge: visible to admins only */}
                  {isAdmin && <PayBadge reg={reg} />}
                  {isAdmin && (
                    <button onClick={() => handleCancel(reg)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95">
                      <X size={14} className="text-red-500" />
                    </button>
                  )}
                </div>

                {/* Pay now prompt — shown to the player themselves if still unpaid */}
                {isMyReg && reg.paymentStatus === 'unpaid' && hasTikkie && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                    <span className="text-xs text-orange-700 flex-1">Don't forget to pay! 💸</span>
                    {isAdminAll && tournament.tikkieLink ? (
                      <a
                        href={tournament.tikkieLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markTikkied(reg.id, reg.paymentStatus)}
                        className="inline-flex items-center gap-1 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0"
                      >
                        <ExternalLink size={11} /> Tikkie
                      </a>
                    ) : null}
                  </div>
                )}

                {/* Transfer spot button */}
                {canTransfer && reg.paymentStatus !== 'transferred' && (
                  <button
                    onClick={() => { setTransferSheet({ reg }); setTransferSearch('') }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-xl py-1.5 font-medium active:scale-95 transition-all"
                  >
                    <ArrowRightLeft size={12} /> Transfer spot to another player
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
      )}

      {/* Waitlist — hidden for completed tournaments */}
      {!isCompleted && waitlisted.length > 0 && (
        <section>
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            Waitlist ({waitlisted.length})
          </h3>
          <div className="space-y-2">
            {waitlisted.map((reg, idx) => {
              const p = getPlayer(reg.playerId)
              if (!p) return null
              return (
                <div key={reg.id} className="card flex items-center gap-3 border-l-4 border-orange-300">
                  <span className="text-xs text-orange-400 w-5 text-center font-bold">W{idx + 1}</span>
                  <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{displayName(p)}</p>
                    <p className="text-xs text-gray-400">Waitlist position {idx + 1}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => handleMoveToRegistered(reg)}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold">
                        Confirm
                      </button>
                      <button onClick={() => handleCancel(reg)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50">
                        <X size={14} className="text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── SCORES + RANKINGS ── */}
      {(() => {
        const savedMatches = getTournamentMatches(tournament.id)
        if (savedMatches.length === 0 && tournament.status !== 'completed') return null

        // Extract the numeric court index from labels like "Court 1", "Court 12"
        // so we can sort ascending. Falls back to the raw label for anything
        // unusual (e.g. court names like "Centre Court").
        const courtOrder = (label) => {
          const m = String(label ?? '').match(/(\d+)/)
          return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
        }

        // Group by round
        const byRound = {}
        savedMatches.forEach(m => {
          const r = m.round || 1
          if (!byRound[r]) byRound[r] = []
          byRound[r].push(m)
        })
        // Sort each round's matches by court number ascending so the admin
        // always fills scores in the same order as they happen on the
        // courts (Court 1 first, then Court 2, ..., Court 8).
        Object.keys(byRound).forEach(r => {
          byRound[r].sort((a, b) => courtOrder(a.court) - courtOrder(b.court))
        })
        const roundNums = Object.keys(byRound).map(Number).sort((a, b) => a - b)

        const firstName = (id) => {
          const p = players.find(x => x.id === id)
          return p ? p.name.split(' ')[0] : '?'
        }

        // Score 0-15 dropdown
        const ScoreSelect = ({ value, matchId, field, otherField, otherValue }) => (
          <select
            value={value ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? null : parseInt(e.target.value)
              updateMatch(matchId, {
                [field]: v,
                [otherField]: otherValue ?? 0,
                completed: v != null,
              })
            }}
            className="w-11 h-9 text-center text-base font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal bg-white"
          >
            <option value="">—</option>
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        )

        // Compute rankings from all scored matches
        const regs2 = getTournamentRegistrations(tournament.id).filter(r => r.status === 'registered')
        const regPlayerIds = regs2.map(r => r.playerId)
        const stats = {}
        regPlayerIds.forEach(id => {
          const p = players.find(x => x.id === id)
          if (p) stats[id] = { player: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, pts: 0 }
        })
        savedMatches.filter(m => m.completed && m.score1 != null && m.score2 != null).forEach(m => {
          const s1 = m.score1, s2 = m.score2
          const t1won = s1 > s2, t2won = s2 > s1
          ;(m.team1Ids || []).forEach(id => {
            if (!stats[id]) return
            stats[id].played++; stats[id].pf += s1; stats[id].pa += s2; stats[id].pts += s1
            if (t1won) stats[id].won++
            else if (t2won) stats[id].lost++
          })
          ;(m.team2Ids || []).forEach(id => {
            if (!stats[id]) return
            stats[id].played++; stats[id].pf += s2; stats[id].pa += s1; stats[id].pts += s2
            if (t2won) stats[id].won++
            else if (t1won) stats[id].lost++
          })
        })
        const rankings = Object.values(stats).sort((a, b) =>
          b.pts !== a.pts ? b.pts - a.pts : b.won !== a.won ? b.won - a.won : (b.pf - b.pa) - (a.pf - a.pa)
        )

        const allScored = savedMatches.length > 0 && savedMatches.every(m => m.completed)
        const isCompleted = tournament.status === 'completed'

        const handleMarkComplete = async () => {
          setMarking(true)
          await updateTournament(tournament.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          })
          setMarking(false)
        }

        return (
          <section className="space-y-4">
            {/* Completed banner */}
            {isCompleted && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <div>
                  <p className="font-bold text-green-800 text-sm">Tournament Completed</p>
                  {tournament.completedAt && (
                    <p className="text-xs text-green-600">
                      {new Date(tournament.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab switcher — only for completed tournaments. Toggles between
                the Final Ranking card and the per-round Match Scores. */}
            {isCompleted && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setCompletedTab('ranking')}
                  className={`flex-1 py-2 text-sm rounded-lg font-semibold transition-all ${
                    completedTab === 'ranking' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                  }`}>
                  🥇 Final Ranking
                </button>
                <button onClick={() => setCompletedTab('matches')}
                  className={`flex-1 py-2 text-sm rounded-lg font-semibold transition-all ${
                    completedTab === 'matches' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                  }`}>
                  📋 Matches
                </button>
              </div>
            )}

            {/* Rankings — show when all scored or completed. In the completed
                view, only render when the Ranking tab is active. */}
            {(allScored || isCompleted) && rankings.length > 0
              && (!isCompleted || completedTab === 'ranking') && (
              <div className="card space-y-3">
                <p className="font-bold text-gray-700">🥇 Final Rankings</p>

                {/* Podium top 3 */}
                {rankings.length >= 2 && (
                  <div className="flex items-end justify-center gap-2 py-2">
                    {/* 2nd */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-xl">🥈</span>
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                        {rankings[1]?.player.name[0]}
                      </div>
                      <p className="text-xs font-semibold text-center truncate w-full text-center">{rankings[1]?.player.name.split(' ')[0]}</p>
                      <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-600">{rankings[1]?.pts}pts</span>
                      </div>
                    </div>
                    {/* 1st */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-2xl">🥇</span>
                      <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
                        {rankings[0]?.player.name[0]}
                      </div>
                      <p className="text-xs font-bold text-center truncate w-full text-center">{rankings[0]?.player.name.split(' ')[0]}</p>
                      <div className="bg-yellow-400 w-full h-16 rounded-t-xl flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{rankings[0]?.pts}pts</span>
                      </div>
                    </div>
                    {/* 3rd — use the true bronze hex (#CD7F32) the History
                        and Scores views use, so every place the podium is
                        rendered matches. The Tailwind amber-300 that was
                        here before reads as another gold shade next to 1st. */}
                    {rankings[2] && (
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-xl">🥉</span>
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                          style={{ background: '#CD7F32' }}
                        >
                          {rankings[2]?.player.name[0]}
                        </div>
                        <p className="text-xs font-semibold text-center truncate w-full text-center">{rankings[2]?.player.name.split(' ')[0]}</p>
                        <div
                          className="w-full h-7 rounded-t-xl flex items-center justify-center"
                          style={{ background: '#CD7F32' }}
                        >
                          <span className="text-xs font-bold text-white">{rankings[2]?.pts}pts</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Full table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 uppercase border-b border-gray-100">
                        <th className="text-left pb-1.5 pl-1">#</th>
                        <th className="text-left pb-1.5">Player</th>
                        <th className="text-center pb-1.5">W</th>
                        <th className="text-center pb-1.5">L</th>
                        <th className="text-center pb-1.5">+/-</th>
                        <th className="text-center pb-1.5 font-bold text-gray-600">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.map((s, i) => (
                        <tr key={s.player.id} className="border-b border-gray-50">
                          <td className="py-1.5 pl-1 text-gray-400 font-bold">{i + 1}</td>
                          <td className="py-1.5 font-medium truncate max-w-[110px]">{s.player.name}</td>
                          <td className="text-center py-1.5 text-green-600 font-semibold">{s.won}</td>
                          <td className="text-center py-1.5 text-red-400">{s.lost}</td>
                          <td className="text-center py-1.5 text-gray-400">{s.pf}-{s.pa}</td>
                          <td className="text-center py-1.5 font-bold text-lobster-teal">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400">Total game points · Tiebreak: matches won → head-to-head</p>
              </div>
            )}

            {/* Admin: Mark Complete */}
            {isAdmin && allScored && !isCompleted && (
              <button
                onClick={handleMarkComplete}
                disabled={marking}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {marking ? 'Saving…' : '✓ Mark Tournament as Complete'}
              </button>
            )}

            {/* Scores per round — hidden when completed and the Ranking tab
                is the active one, so the Final Ranking takes the whole screen.

                Visibility rules:
                 - Admins see every match on every round (they need the full
                   picture to enter scores).
                 - Players (non-admin) see ONLY the match they're playing in
                   that round — their court, their partner, their opponents.
                   Other courts are hidden to keep the screen focused.
                 - Completed tournaments fall back to showing everything, so
                   the history view keeps the full schedule on record. */}
            {(!isCompleted || completedTab === 'matches') && (() => {
              const isPlayerView = !isAdmin && !isCompleted
              const claimedStr   = claimedId ? String(claimedId) : null
              const playerInMatch = (m) =>
                claimedStr &&
                ((m.team1Ids || []).map(String).includes(claimedStr) ||
                 (m.team2Ids || []).map(String).includes(claimedStr))

              return (
                <div>
                  <h3 className="font-bold text-gray-700 mb-3">
                    {isPlayerView ? '🎾 Your Matches' : '📋 Match Scores'}
                  </h3>
                  {isPlayerView && !claimedStr && (
                    <p className="text-sm text-gray-400 mb-3">Sign in to see your own schedule.</p>
                  )}
                  {roundNums.map(r => {
                    const roundMatches = byRound[r]
                    const visibleMatches = isPlayerView
                      ? roundMatches.filter(playerInMatch)
                      : roundMatches
                    return (
                      <div key={r} className="mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Round {r}</p>
                        <div className="space-y-2">
                          {visibleMatches.length === 0 && isPlayerView && (
                            <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-3">
                              You're sitting out this round — grab a drink, cheer the others on.
                            </p>
                          )}
                          {visibleMatches.map(match => {
                            const t1 = (match.team1Ids || []).map(id => firstName(id)).join(' & ')
                            const t2 = (match.team2Ids || []).map(id => firstName(id)).join(' & ')
                            return (
                              <div key={match.id} className={`card ${match.completed ? 'border-l-4 border-green-300' : ''}`}>
                                {match.court && (
                                  <p className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full inline-block mb-2">{match.court}</p>
                                )}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{t1}</p>
                                  </div>
                                  <div className="flex-shrink-0 flex items-center gap-1">
                                    {isAdmin && !isCompleted ? (
                                      <>
                                        <ScoreSelect matchId={match.id} field="score1" otherField="score2" value={match.score1} otherValue={match.score2} />
                                        <span className="text-gray-400 font-bold text-sm">-</span>
                                        <ScoreSelect matchId={match.id} field="score2" otherField="score1" value={match.score2} otherValue={match.score1} />
                                      </>
                                    ) : (
                                      <span className="text-base font-bold text-gray-700 px-1">
                                        {match.score1 != null ? `${match.score1} - ${match.score2}` : '— - —'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 text-right">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{t2}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {savedMatches.length === 0 && isCompleted && (
                    <p className="text-sm text-gray-400 text-center py-4">No match data available</p>
                  )}
                </div>
              )
            })()}
          </section>
        )
      })()}

      {/* Cancelled — hidden for completed tournaments */}
      {!isCompleted && cancelled.length > 0 && (
        <section>
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 opacity-60">
            <UserX size={16} />
            Cancelled ({cancelled.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {cancelled.map(reg => {
              const p = getPlayer(reg.playerId)
              if (!p) return null
              return (
                <div key={reg.id} className="card flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold text-sm flex-shrink-0">
                    {p.name[0]}
                  </div>
                  <p className="text-sm text-gray-500 line-through">{displayName(p)}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── POST-REGISTRATION PAYMENT SHEET ── */}
      {paymentSheet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl">🦞</p>
                <h3 className="font-bold text-gray-800 mt-1">You're in! Now pay to lock your spot</h3>
              </div>
              <button onClick={closePaymentSheet}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            {costPerPlayer > 0 && (
              <div className="bg-lobster-cream rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Your share</span>
                <span className="text-2xl font-bold text-lobster-teal">{fmtEur(costPerPlayer)}</span>
              </div>
            )}

            {/* Tikkie button(s) — grays out after click, and auto-marks the
                registration as "Tikkied" so admins can see the player started
                the payment flow even if they never come back to confirm. */}
            {isAdminAll && tournament.tikkieLink && (
              <a
                href={tournament.tikkieLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setTikkieClicked(true)
                  markTikkied(paymentSheet.regId, paymentSheet.paymentStatus)
                }}
                className={`flex items-center justify-center gap-2 w-full text-base font-bold py-3.5 rounded-2xl transition-all ${
                  tikkieClicked
                    ? 'bg-gray-200 text-gray-500 pointer-events-none'
                    : 'bg-[#FF6B35] text-white active:scale-95'
                }`}
              >
                <ExternalLink size={18} />
                {tikkieClicked ? 'Tikkie opened ✓' : 'Pay via Tikkie now'}
              </a>
            )}
            {!isAdminAll && (tournament.courts || []).filter(c => c.tikkieLink).map((c, i) => (
              <a
                key={i}
                href={c.tikkieLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setTikkieClicked(true)
                  markTikkied(paymentSheet.regId, paymentSheet.paymentStatus)
                }}
                className={`flex items-center justify-center gap-2 w-full text-sm font-bold py-3 rounded-2xl transition-all ${
                  tikkieClicked
                    ? 'bg-gray-200 text-gray-500 pointer-events-none'
                    : 'bg-[#FF6B35] text-white active:scale-95'
                }`}
              >
                <ExternalLink size={16} />
                {tikkieClicked ? 'Tikkie opened ✓' : `Pay for ${c.name || `Court ${i + 1}`} via Tikkie`}
              </a>
            ))}

            {/* "I've sent the payment" — only appears after Tikkie was clicked */}
            {tikkieClicked && (
              <>
                <button
                  onClick={handleSelfDeclare}
                  disabled={declaring}
                  className="w-full flex items-center justify-center gap-2 border-2 border-lobster-teal text-lobster-teal font-semibold py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-40"
                >
                  <Send size={16} /> {declaring ? 'Saving…' : "I've sent the payment"}
                </button>
                <p className="text-xs text-gray-400 text-center -mt-2">
                  This notifies the admin to confirm your payment
                </p>
              </>
            )}

            {/* Add-to-calendar CTA — always visible in the payment sheet so every
                registrant sees it once, with 24h + 2h reminders baked in. */}
            <AddToCalendarButton tournament={tournament} />
            <p className="text-xs text-gray-400 text-center -mt-2">
              We'll nudge you 24h and 2h before. No notifications from us — it runs from your own calendar.
            </p>
          </div>
        </div>
      )}

      {/* ── TRANSFER SHEET ── */}
      {transferSheet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Transfer your spot</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Pick who takes over — they join as registered.
                  Sort the payment between yourselves.
                </p>
              </div>
              <button onClick={() => { setTransferSheet(null); setTransferSearch('') }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
              ⚠ Your spot will be <strong>cancelled</strong> and the new player will be registered. Payment between you is handled outside the app.
            </div>

            <input
              type="text"
              placeholder="🔍 Search player…"
              value={transferSearch}
              onChange={e => setTransferSearch(e.target.value)}
              className="input"
              autoFocus
            />

            <div className="overflow-y-auto flex-1 space-y-2">
              {transferCandidates.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No available players found</p>
              )}
              {transferCandidates.map(p => (
                <button
                  key={p.id}
                  onClick={() => !transferring && handleTransferConfirm(p)}
                  disabled={transferring}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-lobster-cream active:scale-[0.98] transition-all text-left disabled:opacity-40"
                >
                  <div className="w-9 h-9 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(p.name || '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                      {displayName(p)}
                      {waitlistedIds.includes(p.id) && (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          On waitlist
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">Lv {(p.adjustedLevel || 0).toFixed(1)}</p>
                  </div>
                  <ArrowRightLeft size={14} className="text-lobster-teal flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Event description block ──────────────────────────────────────────────
// Read-only card for players. For admins, clicking the pencil swaps the
// block for a textarea with Save / Cancel so copy tweaks don't require
// opening the full event-edit form. An empty description is still shown
// to admins (as a "+ Add description" prompt) so they can start one on
// the spot without leaving the page.
function EventDescription({ tournament, isAdmin, onSave }) {
  const original = tournament.notes || ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(original)
  const [saving, setSaving] = useState(false)

  // Keep the draft in sync if the tournament changes while this page is
  // mounted (e.g. realtime update from another admin).
  useEffect(() => {
    if (!editing) setDraft(original)
  }, [original, editing])

  const hasText = original.trim().length > 0

  const startEdit = () => {
    setDraft(original)
    setEditing(true)
  }
  const cancel = () => {
    setDraft(original)
    setEditing(false)
  }
  const save = async () => {
    if (draft === original) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 space-y-2">
        <textarea
          autoFocus
          className="input resize-none w-full text-sm leading-relaxed"
          rows={5}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="What should players know about this event?"
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-xs font-semibold text-gray-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-lobster-teal active:scale-95 transition-all flex items-center gap-1"
          >
            <Check size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  // Not editing. Hide completely for non-admins when there's no content.
  if (!hasText && !isAdmin) return null

  return (
    <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100 relative">
      {hasText ? (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line pr-7">
          {tournament.notes}
        </p>
      ) : (
        <p className="text-sm text-gray-400 italic pr-7">No description yet.</p>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={startEdit}
          aria-label="Edit description"
          className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-lobster-teal hover:bg-white active:scale-95 transition-all"
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  )
}
