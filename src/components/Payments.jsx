import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, CheckCircle, AlertCircle, ExternalLink, UserCog, ShieldCheck } from 'lucide-react'

const METHODS = [
  { value: 'tikkie',    label: 'Tikkie' },
  { value: 'playtomic', label: 'Playtomic' },
]

export default function Payments({ tournament, onNavigate }) {
  const { players, getTournamentRegistrations, updateRegistration, isAdmin } = useApp()
  const [filter, setFilter]       = useState('all')

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

  const isAdminAll = !tournament.courtBookingMode || tournament.courtBookingMode === 'admin_all'

  const regs = getTournamentRegistrations(tournament.id).filter(r => r.status === 'registered')
  const paid    = regs.filter(r => r.paymentStatus === 'paid' || r.paymentStatus === 'transferred')
  const pending = regs.filter(r => r.paymentStatus === 'pending_confirmation')
  const unpaid  = regs.filter(r => r.paymentStatus !== 'paid' && r.paymentStatus !== 'transferred')

  // Cost per player depends on booking mode
  const costPerPlayer = isAdminAll
    ? (tournament.totalPrice > 0 ? tournament.totalPrice / (tournament.maxPlayers || regs.length || 1) : 0)
    : (tournament.courts || []).reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0)

  const totalCollected = paid.length   * costPerPlayer
  const totalExpected  = regs.length   * costPerPlayer

  const filtered = filter === 'paid' ? paid : filter === 'unpaid' ? unpaid : filter === 'pending' ? pending : regs
  const getPlayer = (id) => players.find(p => p.id === id)

  const handleMarkPaid = async (reg, method) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    await updateRegistration(reg.id, { paymentStatus: 'paid', paymentMethod: method })
  }

  const handleMarkUnpaid = async (reg) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    await updateRegistration(reg.id, { paymentStatus: 'unpaid', paymentMethod: '' })
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lob-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <p className="text-sm text-gray-500">Payment Tracker · {formatDate(tournament.date)}</p>
      </div>

      {/* Payment info banner */}
      {isAdminAll ? (
        <div className="bg-lob-teal-light rounded-2xl p-4 space-y-2 border border-lob-teal/10">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={15} className="text-lob-teal" />
            <span className="text-sm font-bold text-gray-700">Admin booked all courts</span>
          </div>
          {tournament.totalPrice > 0 && (
            <p className="text-sm text-gray-600">
              Total: <span className="font-bold text-gray-800">€{parseFloat(tournament.totalPrice).toFixed(2)}</span>
              {' '}· Per player: <span className="font-bold text-lobster-teal">€{costPerPlayer.toFixed(2)}</span>
              <span className="text-xs text-gray-400"> (÷ {tournament.maxPlayers} players)</span>
            </p>
          )}
          {tournament.tikkieLink && (
            <a
              href={tournament.tikkieLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
            >
              <ExternalLink size={14} /> Pay via Tikkie
            </a>
          )}
          {!tournament.tikkieLink && (
            <p className="text-xs text-gray-400">No Tikkie link set — payment via Playtomic or cash</p>
          )}
        </div>
      ) : (
        /* Player-responsible: show per-court Tikkie links */
        (tournament.courts || []).some(c => c.tikkieLink || c.responsible) && (
          <div className="bg-purple-50 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <UserCog size={15} className="text-purple-600" />
              <span className="text-sm font-bold text-gray-700">Court payments</span>
            </div>
            {(tournament.courts || []).map((c, i) => (
              (c.responsible || c.tikkieLink) ? (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{c.name || `Court ${i + 1}`}</p>
                    {c.responsible && <p className="text-xs text-gray-500">Responsible: {c.responsible}</p>}
                    {c.costPerPerson > 0 && <p className="text-xs text-gray-500">€{c.costPerPerson}/pp</p>}
                  </div>
                  {c.tikkieLink && (
                    <a
                      href={c.tikkieLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0"
                    >
                      <ExternalLink size={12} /> Tikkie
                    </a>
                  )}
                </div>
              ) : null
            ))}
          </div>
        )
      )}

      {/* Summary */}
      <div className="bg-lob-teal rounded-2xl p-4 text-white shadow-lg">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-300">{paid.length}</p>
            <p className="text-xs opacity-75">Paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-300">{pending.length}</p>
            <p className="text-xs opacity-75">Paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-300">{unpaid.length - pending.length}</p>
            <p className="text-xs opacity-75">Unpaid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{regs.length}</p>
            <p className="text-xs opacity-75">Total</p>
          </div>
        </div>

        {costPerPlayer > 0 && (
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Cost per player</span>
              <span className="font-bold">€{costPerPlayer.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Collected</span>
              <span className="font-bold text-green-300">€{totalCollected.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-80">Still owed</span>
              <span className="font-bold text-red-300">€{(totalExpected - totalCollected).toFixed(2)}</span>
            </div>
            <div className="mt-3 bg-white/20 rounded-full h-3 overflow-hidden progress-bar">
              <div
                className="h-full bg-gradient-to-r from-green-300 to-green-400 rounded-full transition-all"
                style={{ width: totalExpected > 0 ? `${(totalCollected / totalExpected) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter tabs — pill style */}
      <div className="flex gap-2">
        {[
          ['all',     'All',    regs.length],
          ['unpaid',  'Unpaid', unpaid.length - pending.length],
          ['pending', 'Paid ⏳', pending.length],
          ['paid',    'Paid',   paid.length],
        ].map(([v, l, count]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`flex-1 py-2.5 px-2 text-xs font-semibold rounded-full transition-all ${
              filter === v
                ? v === 'pending' ? 'bg-amber-400 text-white shadow-md' : 'bg-lob-coral text-white shadow-md'
                : 'bg-lob-teal-light text-lob-muted hover:bg-opacity-80'
            }`}
          >
            {l}
            <span className={`ml-1 text-xs font-bold ${filter === v ? 'text-white/80' : 'text-lob-muted'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Payment list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card py-6 text-center text-gray-400">
            <CheckCircle size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No players here</p>
          </div>
        )}

        {filtered.map(reg => {
          const player = getPlayer(reg.playerId)
          if (!player) return null
          const ps = reg.paymentStatus
          const isPaid        = ps === 'paid' || ps === 'transferred'
          const isPending     = ps === 'pending_confirmation'
          const isTransferred = ps === 'transferred'

          const borderColor = isPaid ? 'border-green-400' : isPending ? 'border-amber-400' : 'border-red-300'
          const avatarColor = isPaid ? 'bg-green-100 text-green-700' : isPending ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'

          return (
            <div key={reg.id} className={`card transition-all border-l-4 ${borderColor}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${avatarColor}`}>
                  {player.name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{player.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isTransferred
                      ? <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">↔ Transferred</span>
                      : isPaid
                        ? <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ {METHODS.find(m => m.value === reg.paymentMethod)?.label || 'Paid'}</span>
                        : isPending
                          ? <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Payment sent</span>
                          : <span className="text-xs font-semibold bg-lob-coral-light text-lob-coral px-2 py-0.5 rounded-full">⚠ Unpaid</span>
                    }
                    {costPerPlayer > 0 && !isTransferred && (
                      <span className="text-xs text-gray-400">€{costPerPlayer.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  isPaid ? (
                    <button
                      onClick={() => handleMarkUnpaid(reg)}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                    >
                      Undo
                    </button>
                  ) : isPending ? (
                    /* One-tap confirm for self-declared payments */
                    <button
                      onClick={() => handleMarkPaid(reg, 'tikkie')}
                      className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                    >
                      Confirm ✓
                    </button>
                  ) : (
                    <PaymentMethodPicker onSelect={(method) => handleMarkPaid(reg, method)} />
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaymentMethodPicker({ onSelect }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
      >
        Mark Paid ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[130px] overflow-hidden">
            {METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => { onSelect(m.value); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
