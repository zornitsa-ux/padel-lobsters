import React from 'react'
import { Clock, X } from 'lucide-react'

export default function WaitlistSection({
  isCompleted,
  waitlisted,
  getPlayer,
  displayName,
  isAdmin,
  onMoveToRegistered,
  onCancel,
}) {
  if (isCompleted || waitlisted.length === 0) return null

  return (
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
                  <button
                    onClick={() => onMoveToRegistered(reg)}
                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onCancel(reg)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50"
                  >
                    <X size={14} className="text-red-500" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
