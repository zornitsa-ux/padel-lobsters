import React from 'react'
import { Plus, Search, X } from 'lucide-react'

export default function AddPlayerCard({
  isCompleted,
  showAdd,
  onOpen,
  onClose,
  search,
  onSearchChange,
  availablePlayers,
  selectedPlayer,
  onSelectPlayer,
  onAdd,
  saving,
  registeredCount,
  maxPlayers,
  displayName,
}) {
  if (isCompleted) return null

  if (!showAdd) {
    return (
      <button
        onClick={onOpen}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Plus size={18} /> Register a Player
      </button>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-700">Select Player</p>
        <button onClick={onClose}>
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9 py-2 text-sm"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {availablePlayers.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">All players already registered</p>
        )}

        {availablePlayers.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectPlayer(selectedPlayer === p.id ? '' : p.id)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
              selectedPlayer === p.id
                ? 'bg-lobster-teal text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                selectedPlayer === p.id
                  ? 'bg-white text-lobster-teal'
                  : 'bg-lobster-teal text-white'
              }`}
            >
              {(p.name || '?')[0]}
            </div>
            <span className="flex-1 text-left font-medium text-sm">{displayName(p)}</span>
            <span
              className={`text-xs font-bold ${selectedPlayer === p.id ? 'text-white' : 'text-gray-500'}`}
            >
              Lv {(p.adjustedLevel || 0).toFixed(1)}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={onAdd}
        disabled={!selectedPlayer || saving}
        className="btn-primary w-full py-2.5 text-sm"
      >
        {saving
          ? 'Adding...'
          : registeredCount >= maxPlayers
            ? 'Add to Waitlist'
            : 'Register Player'}
      </button>
    </div>
  )
}
