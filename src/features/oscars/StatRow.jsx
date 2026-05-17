import React from 'react'
import { ChevronDown } from 'lucide-react'

/* ─── Admin: per-category live participation row ──────────────────────── */
export default function StatRow({ stat, expanded, voters, onToggle }) {
  const pct =
    stat.total_participants > 0 ? Math.round((stat.votes_count / stat.total_participants) * 100) : 0
  const voted = (voters || []).filter((v) => v.voted)
  const notVoted = (voters || []).filter((v) => !v.voted)
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 text-left active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{stat.category_icon}</span>
          <span className="flex-1 font-semibold text-sm text-gray-700">{stat.category_name}</span>
          <span className="text-xs text-gray-500 font-semibold">
            <span className="text-lobster-teal text-base font-bold">{stat.votes_count}</span> of{' '}
            {stat.total_participants} voted
          </span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-lobster-teal to-lobster-orange transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase font-bold text-green-700 tracking-wide mb-1">
              ✓ Voted ({voted.length})
            </p>
            <div className="space-y-0.5">
              {voted.length === 0 && <p className="text-xs text-gray-400 italic">none yet</p>}
              {voted.map((v) => (
                <p key={v.player_id} className="text-xs text-gray-700 truncate">
                  {v.player_name}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wide mb-1">
              ○ Not yet ({notVoted.length})
            </p>
            <div className="space-y-0.5">
              {notVoted.length === 0 && <p className="text-xs text-gray-400 italic">all voted!</p>}
              {notVoted.map((v) => (
                <p key={v.player_id} className="text-xs text-gray-500 truncate">
                  {v.player_name}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
