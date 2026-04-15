import React, { useMemo, useState } from 'react'
import { X, Check, GitMerge, Search, ChevronRight, RotateCcw, UserX } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  buildAliasInventory,
  suggestPlayers,
  NOT_IN_ROSTER,
} from '../lib/playerHistory'

// ─────────────────────────────────────────────────────────────────────────────
//  Admin modal: walk through every historical name from the hardcoded
//  TOURNAMENTS list and tag each one with the matching current player_id.
//  Once tagged, profile cards on the Players page show that player's full
//  tournament history (count, list, podium finishes, total points).
// ─────────────────────────────────────────────────────────────────────────────

export default function PlayerAliasMatcher({ onClose }) {
  const { players, playerAliases, setPlayerAlias, removePlayerAlias } = useApp()

  const inventory = useMemo(() => buildAliasInventory(playerAliases), [playerAliases])

  const [filter, setFilter] = useState('unmatched') // 'unmatched' | 'matched' | 'all'
  const [search, setSearch] = useState('')
  const [picker, setPicker] = useState(null) // { name } | null

  const playersById = useMemo(() => {
    const m = {}
    ;(players || []).forEach(p => { m[p.id] = p })
    return m
  }, [players])

  const counts = useMemo(() => ({
    unmatched: inventory.filter(i => !i.playerId).length,
    matched:   inventory.filter(i => i.playerId && i.playerId !== NOT_IN_ROSTER).length,
    skipped:   inventory.filter(i => i.playerId === NOT_IN_ROSTER).length,
    all:       inventory.length,
  }), [inventory])

  const visible = useMemo(() => {
    let rows = inventory
    if (filter === 'unmatched') rows = rows.filter(i => !i.playerId)
    else if (filter === 'matched') rows = rows.filter(i => i.playerId && i.playerId !== NOT_IN_ROSTER)
    else if (filter === 'skipped') rows = rows.filter(i => i.playerId === NOT_IN_ROSTER)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(i => i.name.toLowerCase().includes(q))
    }
    // Most-played first inside each filter so high-impact names come up early.
    return [...rows].sort((a, b) => b.tournamentCount - a.tournamentCount)
  }, [inventory, filter, search])

  const handleConfirm = async (name, playerId) => {
    await setPlayerAlias(name, playerId)
    setPicker(null)
  }

  const handleSkip = async (name) => {
    await setPlayerAlias(name, NOT_IN_ROSTER)
  }

  const handleClear = async (name) => {
    await removePlayerAlias(name)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <GitMerge size={18} className="text-lobster-teal" />
                Match Historical Names
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Tag each name from past tournaments to its player profile
              </p>
            </div>
            <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-lobster-teal rounded-full transition-all duration-500"
              style={{ width: `${counts.all > 0 ? ((counts.matched + counts.skipped) / counts.all) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            {counts.matched} matched · {counts.skipped} skipped · {counts.unmatched} to go
          </p>

          {/* Filter pills */}
          <div className="flex gap-1 mt-3">
            {[
              { k: 'unmatched', label: `To do (${counts.unmatched})` },
              { k: 'matched',   label: `Matched (${counts.matched})` },
              { k: 'skipped',   label: `Skipped (${counts.skipped})` },
              { k: 'all',       label: `All (${counts.all})` },
            ].map(p => (
              <button
                key={p.k}
                onClick={() => setFilter(p.k)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${
                  filter === p.k ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search historical name…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-lobster-teal"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {visible.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              {filter === 'unmatched' ? '🎉 All names matched!' : 'Nothing here.'}
            </div>
          )}

          {visible.map(item => {
            const linkedPlayer = item.playerId && item.playerId !== NOT_IN_ROSTER
              ? playersById[item.playerId]
              : null
            const isSkipped = item.playerId === NOT_IN_ROSTER
            const suggestions = !item.playerId ? suggestPlayers(item.name, players, 3) : []

            return (
              <div
                key={item.name}
                className={`rounded-2xl border-2 px-3 py-2.5 ${
                  linkedPlayer ? 'bg-teal-50 border-teal-200' :
                  isSkipped    ? 'bg-gray-50 border-gray-200' :
                                 'bg-white border-gray-200'
                }`}
              >
                {/* Name + tournament chips */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {item.tournamentLabels.join(' · ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {item.tournamentCount}× {item.tournamentCount >= 3 ? '🔥' : item.tournamentCount === 2 ? '⚡' : ''}
                  </span>
                </div>

                {/* Status row */}
                {linkedPlayer && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Check size={14} className="text-teal-600" />
                      <span className="font-semibold text-teal-700">{linkedPlayer.name}</span>
                    </div>
                    <button
                      onClick={() => handleClear(item.name)}
                      className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Reset
                    </button>
                  </div>
                )}

                {isSkipped && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <UserX size={14} className="text-gray-400" />
                      <span className="font-semibold text-gray-500">Not in roster</span>
                    </div>
                    <button
                      onClick={() => handleClear(item.name)}
                      className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Undo
                    </button>
                  </div>
                )}

                {/* Suggestions + actions for unmatched names */}
                {!item.playerId && (
                  <div className="mt-2 space-y-1.5">
                    {suggestions.length > 0 && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                        Tap a match to confirm:
                      </p>
                    )}
                    {suggestions.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => handleConfirm(item.name, p.id)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 active:scale-[0.98] transition-all ${
                          i === 0
                            ? 'bg-teal-500 border-teal-500 hover:bg-teal-600'
                            : 'bg-teal-50 border-teal-200 hover:bg-teal-100'
                        }`}
                      >
                        <span className={`text-sm font-bold truncate ${i === 0 ? 'text-white' : 'text-teal-700'}`}>
                          ✓ It's {p.name}
                          {i === 0 && <span className="ml-1.5 text-[10px] font-semibold opacity-80">(best match)</span>}
                        </span>
                        <Check size={16} className={`flex-shrink-0 ${i === 0 ? 'text-white' : 'text-teal-600'}`} />
                      </button>
                    ))}
                    {suggestions.length === 0 && (
                      <p className="text-[11px] text-gray-400 italic">
                        No close match found in your roster — pick from the full list or skip.
                      </p>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setPicker({ name: item.name })}
                        className="flex-1 text-xs font-semibold text-gray-600 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        {suggestions.length > 0 ? 'Different player…' : 'Pick from roster…'} <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => handleSkip(item.name)}
                        className="text-xs font-semibold text-gray-400 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-1"
                      >
                        <UserX size={12} /> Not in roster
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </div>

      {/* Full picker overlay */}
      {picker && (
        <PlayerPicker
          historicalName={picker.name}
          players={players}
          onPick={(playerId) => handleConfirm(picker.name, playerId)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Full-roster picker — used when fuzzy suggestions miss the right player
// ─────────────────────────────────────────────────────────────────────────────
function PlayerPicker({ historicalName, players, onPick, onClose }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const sorted = [...(players || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (!q.trim()) return sorted
    const needle = q.toLowerCase()
    return sorted.filter(p => (p.name || '').toLowerCase().includes(needle))
  }, [players, q])

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-md flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-800">Pick a player for "{historicalName}"</h3>
            <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search roster…"
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-lobster-teal"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {list.map(p => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-teal-50 active:scale-[0.98] transition-all text-left"
            >
              <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
              <span className="text-[11px] text-gray-400">Lv {(p.adjustedLevel || p.adjusted_level || 0).toFixed(1)}</span>
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No players match.</p>}
        </div>
      </div>
    </div>
  )
}
