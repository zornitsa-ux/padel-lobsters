import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  UserCheck, UserX, Clock, ChevronLeft, Search,
  Plus, X, AlertCircle, CheckCircle, Users, ExternalLink,
  UserCog, ArrowRightLeft, Send
} from 'lucide-react'
import { SignInBanner } from './AuthGate'
import { DateTile, AddToCalendarButton } from './CalendarPieces'

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

  const registeredIds = regs.filter(r => r.status !== 'cancelled').map(r => r.playerId)
  const availablePlayers = players
    .filter(p => (p.status || 'active') === 'active')
    .filter(p => !registeredIds.includes(p.id) &&
      (p.name?.toLowerCase().includes(search.toLowerCase()) || !search)
    )

  const maxPlayers = tournament.maxPlayers || 16
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

  // Transfer candidates: active players not already registered/waitlisted in this tournament
  const transferCandidates = players
    .filter(p => (p.status || 'active') === 'active')
    .filter(p => String(p.id) !== String(transferSheet?.reg?.playerId))
    .filter(p => !registeredIds.includes(p.id))
    .filter(p => !transferSearch || p.name.toLowerCase().includes(transferSearch.toLowerCase()))

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Payment status badge helper
  const PayBadge = ({ reg }) => {
    const ps = reg.paymentStatus
    if (ps === 'paid')                  return <span className="badge-paid">Paid</span>
    if (ps === 'transferred')           return <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Transferred</span>
    if (ps === 'pending_confirmation')  return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Paid ⏳</span>
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
          <AddToCalendarButton tournament={tournament} variant="icon" />
        </div>
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


      {/* Game button */}
      <button
        onClick={() => onNavigate('game', tournament)}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-sm shadow"
      >
        🎮 Lobster Games
      </button>

      {/* Add player */}
      {!showAdd ? (
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

      {/* Registered players */}
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

      {/* Waitlist */}
      {waitlisted.length > 0 && (
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

        // Group by round
        const byRound = {}
        savedMatches.forEach(m => {
          const r = m.round || 1
          if (!byRound[r]) byRound[r] = []
          byRound[r].push(m)
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

            {/* Rankings — show when all scored or completed */}
            {(allScored || isCompleted) && rankings.length > 0 && (
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
                    {/* 3rd */}
                    {rankings[2] && (
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-xl">🥉</span>
                        <div className="w-10 h-10 bg-amber-300 rounded-full flex items-center justify-center font-bold text-white">
                          {rankings[2]?.player.name[0]}
                        </div>
                        <p className="text-xs font-semibold text-center truncate w-full text-center">{rankings[2]?.player.name.split(' ')[0]}</p>
                        <div className="bg-amber-300 w-full h-7 rounded-t-xl flex items-center justify-center">
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

            {/* Scores per round */}
            <div>
              <h3 className="font-bold text-gray-700 mb-3">📋 Match Scores</h3>
              {roundNums.map(r => (
                <div key={r} className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Round {r}</p>
                  <div className="space-y-2">
                    {byRound[r].map(match => {
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
              ))}
              {savedMatches.length === 0 && isCompleted && (
                <p className="text-sm text-gray-400 text-center py-4">No match data available</p>
              )}
            </div>
          </section>
        )
      })()}

      {/* Cancelled */}
      {cancelled.length > 0 && (
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
                <span className="text-2xl font-bold text-lobster-teal">€{costPerPlayer.toFixed(2)}</span>
              </div>
            )}

            {/* Tikkie button(s) — grays out after click */}
            {isAdminAll && tournament.tikkieLink && (
              <a
                href={tournament.tikkieLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTikkieClicked(true)}
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
                onClick={() => setTikkieClicked(true)}
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
                    <p className="font-semibold text-sm text-gray-800">{displayName(p)}</p>
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
