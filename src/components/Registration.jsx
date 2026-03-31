import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  UserCheck, UserX, Clock, ChevronLeft, Search,
  Plus, X, AlertCircle, CheckCircle, Users
} from 'lucide-react'
import AdminLogin from './AdminLogin'

export default function Registration({ tournament, onNavigate }) {
  const {
    players, registrations, registerPlayer, cancelRegistration,
    updateRegistration, getTournamentRegistrations, isAdmin
  } = useApp()

  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [saving, setSaving]       = useState(false)

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
  const availablePlayers = players.filter(
    p => !registeredIds.includes(p.id) &&
    (p.name?.toLowerCase().includes(search.toLowerCase()) || !search)
  )

  const maxPlayers = tournament.maxPlayers || 16

  const getPlayer = (id) => players.find(p => p.id === id)

  const handleAdd = async () => {
    if (!selectedPlayer) return
    setSaving(true)
    try {
      await registerPlayer(tournament.id, selectedPlayer, maxPlayers)
      setSelectedPlayer(''); setShowAdd(false); setSearch('')
    } finally { setSaving(false) }
  }

  const handleCancel = async (reg) => {
    if (!isAdmin) { setShowLogin(true); return }
    if (!confirm(`Cancel ${getPlayer(reg.playerId)?.name}'s registration?`)) return
    await cancelRegistration(reg.id, tournament.id)
  }

  const handleMoveToRegistered = async (reg) => {
    if (!isAdmin) { setShowLogin(true); return }
    await updateRegistration(reg.id, { status: 'registered' })
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
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
            return (
              <div key={reg.id} className="card flex items-center gap-3">
                <span className="text-xs text-gray-400 w-5 text-center font-bold">#{idx + 1}</span>
                <div className="w-9 h-9 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">Level {(p.adjustedLevel || 0).toFixed(1)}</p>
                </div>
                <span className={reg.paymentStatus === 'paid' ? 'badge-paid' : 'badge-unpaid'}>
                  {reg.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
                {isAdmin && (
                  <button onClick={() => handleCancel(reg)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95">
                    <X size={14} className="text-red-500" />
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
    </div>
  )
}
