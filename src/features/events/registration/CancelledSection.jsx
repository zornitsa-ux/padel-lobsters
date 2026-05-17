import React from 'react'
import { UserX } from 'lucide-react'

export default function CancelledSection({ isCompleted, cancelled, getPlayer, displayName }) {
  if (isCompleted || cancelled.length === 0) return null

  return (
    <section>
      <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 opacity-60">
        <UserX size={16} />
        Cancelled ({cancelled.length})
      </h3>
      <div className="space-y-2 opacity-60">
        {cancelled.map((reg) => {
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
  )
}
