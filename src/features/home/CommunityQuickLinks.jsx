import React from 'react'
import { Users, Calendar, Trophy, Award } from 'lucide-react'

// ── Community quick links ─────────────────────────────── */
export default function CommunityQuickLinks({
  onNavigate,
  activePlayersCount,
  upcomingCount,
  pastCount,
  lastPodium,
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <button
        onClick={() => onNavigate('players')}
        className="bg-white rounded-2xl py-3 text-center shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all"
      >
        <Users size={16} className="text-lobster-teal mx-auto mb-1" />
        <p className="text-base font-bold text-gray-800">{activePlayersCount}</p>
        <p className="text-[9px] text-gray-400 font-medium">Players</p>
      </button>
      <button
        onClick={() => onNavigate('tournament')}
        className="bg-white rounded-2xl py-3 text-center shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all"
      >
        <Calendar size={16} className="text-lobster-orange mx-auto mb-1" />
        <p className="text-base font-bold text-gray-800">{upcomingCount}</p>
        <p className="text-[9px] text-gray-400 font-medium">Upcoming</p>
      </button>
      <button
        onClick={() => onNavigate('history')}
        className="bg-white rounded-2xl py-3 text-center shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all"
      >
        <Trophy size={16} className="text-yellow-500 mx-auto mb-1" />
        <p className="text-base font-bold text-gray-800">{pastCount}</p>
        <p className="text-[9px] text-gray-400 font-medium">Past</p>
      </button>
      <button
        onClick={() => onNavigate('history')}
        className="bg-white rounded-2xl py-2 shadow-md border border-gray-100 active:scale-[0.95] active:shadow-sm transition-all overflow-hidden"
      >
        <Award size={16} className="text-yellow-500 mx-auto mb-0.5" />
        {lastPodium && lastPodium.length > 0 ? (
          <div className="px-1.5">
            {lastPodium.map((name, i) => (
              <p
                key={i}
                className="text-[11px] font-bold text-gray-700 truncate leading-snug text-left"
              >
                {['🥇', '🥈', '🥉'][i]} {name}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-base font-bold text-gray-300">—</p>
        )}
      </button>
    </div>
  )
}
