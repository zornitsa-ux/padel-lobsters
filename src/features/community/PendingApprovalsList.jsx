import React from 'react'
import { Clock, X } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'

export default function PendingApprovalsList({ pendingPlayers, onApprove, onReject, onLink }) {
  if (pendingPlayers.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-orange-500" />
        <p className="text-sm font-bold text-orange-600">
          Waiting for approval ({pendingPlayers.length})
        </p>
      </div>
      {pendingPlayers.map((p) => (
        <div key={p.id} className="card border-l-4 border-orange-300 space-y-2">
          <div className="flex items-center gap-3">
            <Avatar player={p} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{p.name}</p>
              <p className="text-xs text-gray-500">
                Lv {(p.adjustedLevel || 0).toFixed(1)}
                {p.email && ` · ${p.email}`}
              </p>
            </div>
            <button
              onClick={() => onReject(p.id)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95 flex-shrink-0"
            >
              <X size={13} className="text-red-500" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(p)}
              className="flex-1 text-xs bg-green-500 text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all"
            >
              ✓ Approve as new player
            </button>
            <button
              onClick={() => onLink(p)}
              className="flex-1 text-xs bg-lobster-teal text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all"
            >
              🔗 Played before?
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
