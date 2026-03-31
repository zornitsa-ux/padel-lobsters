import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, CreditCard, CheckCircle, AlertCircle, Euro } from 'lucide-react'
import AdminLogin from './AdminLogin'

const METHODS = [
  { value: 'ideal',     label: 'iDEAL' },
  { value: 'wero',      label: 'Wero' },
  { value: 'playtomic', label: 'Playtomic' },
  { value: 'cash',      label: 'Cash' },
  { value: 'other',     label: 'Other' },
]

export default function Payments({ tournament, onNavigate }) {
  const {
    players, getTournamentRegistrations, updateRegistration, isAdmin
  } = useApp()
  const [showLogin, setShowLogin] = useState(false)
  const [filter, setFilter]       = useState('all') // all | paid | unpaid

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
    .filter(r => r.status === 'registered')

  const paid   = regs.filter(r => r.paymentStatus === 'paid')
  const unpaid = regs.filter(r => r.paymentStatus !== 'paid')

  const totalCostPP = (tournament.courts || []).reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0)
  const totalCollected = paid.length * totalCostPP
  const totalExpected  = regs.length * totalCostPP

  const filtered = filter === 'paid' ? paid : filter === 'unpaid' ? unpaid : regs

  const getPlayer = (id) => players.find(p => p.id === id)

  const handleMarkPaid = async (reg, method) => {
    if (!isAdmin) { setShowLogin(true); return }
    await updateRegistration(reg.id, { paymentStatus: 'paid', paymentMethod: method })
  }

  const handleMarkUnpaid = async (reg) => {
    if (!isAdmin) { setShowLogin(true); return }
    await updateRegistration(reg.id, { paymentStatus: 'unpaid', paymentMethod: '' })
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

      {/* Back */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <p className="text-sm text-gray-500">Payment Tracker · {formatDate(tournament.date)}</p>
      </div>

      {/* Summary */}
      <div className="bg-lobster-teal rounded-2xl p-4 text-white">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-300">{paid.length}</p>
            <p className="text-xs opacity-75">Paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-300">{unpaid.length}</p>
            <p className="text-xs opacity-75">Unpaid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{regs.length}</p>
            <p className="text-xs opacity-75">Total</p>
          </div>
        </div>

        {totalCostPP > 0 && (
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Cost per player</span>
              <span className="font-bold">€{totalCostPP.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Collected</span>
              <span className="font-bold text-green-300">€{totalCollected.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-80">Still owed</span>
              <span className="font-bold text-red-300">€{(totalExpected - totalCollected).toFixed(2)}</span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 bg-white/20 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-400 h-2 rounded-full transition-all"
                style={{ width: totalExpected > 0 ? `${(totalCollected / totalExpected) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              filter === v ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
            }`}
          >
            {l}
            <span className={`ml-1 text-xs ${filter === v ? 'text-lobster-teal' : 'text-gray-400'}`}>
              {v === 'all' ? regs.length : v === 'paid' ? paid.length : unpaid.length}
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
          const isPaid = reg.paymentStatus === 'paid'

          return (
            <div key={reg.id} className={`card transition-all ${isPaid ? 'border-l-4 border-green-400' : 'border-l-4 border-red-300'}`}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                  isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {player.name[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{player.name}</p>
                  <div className="flex items-center gap-2">
                    {isPaid
                      ? <span className="badge-paid">✓ {reg.paymentMethod ? METHODS.find(m => m.value === reg.paymentMethod)?.label || reg.paymentMethod : 'Paid'}</span>
                      : <span className="badge-unpaid">Unpaid</span>
                    }
                    {totalCostPP > 0 && (
                      <span className="text-xs text-gray-400">€{totalCostPP.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {/* Action */}
                {isAdmin && (
                  isPaid
                    ? (
                      <button
                        onClick={() => handleMarkUnpaid(reg)}
                        className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                      >
                        Undo
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
