import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  UserCheck, UserX, Clock, ChevronLeft, Search,
  Plus, X, AlertCircle, CheckCircle, Users, ExternalLink,
  UserCog, ArrowRightLeft, Send
} from 'lucide-react'
import AdminLogin from './AdminLogin'

export default function Registration({ tournament, onNavigate }) {
  const {
    players, registrations, registerPlayer, cancelRegistration,
    updateRegistration, transferRegistration,
    getTournamentRegistrations, isAdmin, claimedId
  } = useApp()

  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [showLogin, setShowLogin]   = useState(false)
  const [saving, setSaving]         = useState(false)

  // Post-registration payment sheet
  const [paymentSheet, setPaymentSheet] = useState(null)  // { regId, playerId, status }
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring]         = useState(false)

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
    if (!isAdmin) { setShowLogin(true); return }
    if (!confirm(`Cancel ${getPlayer(reg.playerId)?.name}'s registration?`)) return
    await cancelRegistration(reg.id, tournament.id)
  }

  const handleMoveToRegistered = async (reg) => {
    if (!isAdmin) { setShowLogin(true); return }
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
    if (ps === 'pending_confirmation')  return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Sent ⏳</span>
    return <span className="badge-unpaid">Unpaid</span>
  }

  return (
    <div className="space-y-4">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

      {/* Back + header */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <p className="text-sm text-gray-500">{formatDate(tournament.date)}</p>
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
                <span className="flex-1 text-left font-medium text-sm">{p.name}</span>
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
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">Level {(p.adjustedLevel || 0).toFixed(1)}</p>
                  </div>
                  {/* Payment badge: visible to admins and the player themselves */}
                  {(isAdmin || isMyReg) && <PayBadge reg={reg} />}
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
                    <p className="font-semibold text-sm truncate">{p.name}</p>
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
                  <p className="text-sm text-gray-500 line-through">{p.name}</p>
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
                    <p className="font-semibold text-sm text-gray-800">{p.name}</p>
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
