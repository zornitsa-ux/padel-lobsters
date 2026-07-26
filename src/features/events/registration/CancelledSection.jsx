import React from 'react'
import { UserX } from 'lucide-react'
import { PlayerRow } from '../../../components/ui/PlayerRow'

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
            <PlayerRow
              key={reg.id}
              player={p}
              avatarTone="bg-lob-teal-light text-lob-muted"
              className="card"
              name={displayName(p)}
              nameClassName="text-sm text-lob-muted line-through"
            />
          )
        })}
      </div>
    </section>
  )
}
