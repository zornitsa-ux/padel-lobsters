import React, { useState, useMemo } from 'react'
import { ChevronDown, Trophy } from 'lucide-react'

/* ─── Results view (used by both admin post-end and player post-share) ── */
export default function ResultsView({ results, highlightWinners = false, collapsible = false }) {
  // Track which categories are revealed (only used when collapsible)
  const [openIds, setOpenIds] = useState(() => new Set())
  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group by category
  const byCat = useMemo(() => {
    const m = new Map()
    for (const r of results) {
      if (!m.has(r.category_id)) {
        m.set(r.category_id, {
          id: r.category_id,
          name: r.category_name,
          icon: r.category_icon,
          display_order: r.display_order,
          rows: [],
        })
      }
      m.get(r.category_id).rows.push(r)
    }
    return Array.from(m.values()).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  }, [results])

  if (byCat.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center">
        <p className="text-3xl mb-2">🤷</p>
        <p className="text-sm text-gray-500">No votes were cast.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {byCat.map((cat) => {
        const winners = cat.rows.filter((r) => Number(r.rank_in_category) === 1)
        const others = cat.rows.filter((r) => Number(r.rank_in_category) !== 1)
        const isOpen = collapsible ? openIds.has(cat.id) : true

        const Header = (
          <div className="flex items-center gap-2">
            <span className="text-lg">{cat.icon}</span>
            <span className="flex-1 font-bold text-sm text-gray-800">{cat.name}</span>
            {collapsible && !isOpen && (
              <span className="text-[11px] text-gray-400 italic">tap to reveal</span>
            )}
            {collapsible && (
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        )

        const Body = isOpen && (
          <>
            {winners.length > 0 && (
              <div
                className={`rounded-xl px-3 py-2 ${highlightWinners ? 'bg-yellow-50 border border-yellow-200' : 'bg-yellow-50/60'}`}
              >
                <p className="text-sm font-bold text-yellow-900 flex items-center gap-1.5">
                  <Trophy size={15} className="text-yellow-600" />
                  {winners.map((w) => w.target_name).join(', ')}
                  {winners.length > 1 && (
                    <span className="text-xs font-semibold text-yellow-700/80 ml-1">(tied)</span>
                  )}
                </p>
                <p className="text-xs text-yellow-700/80 mt-0.5">
                  {Number(winners[0].votes_count)} vote
                  {Number(winners[0].votes_count) === 1 ? '' : 's'}
                  {winners.length > 1 ? ' each' : ''}
                </p>
              </div>
            )}
            {others.length > 0 && (
              <div className="space-y-1 pt-0.5">
                {others.map((r, i) => (
                  <div
                    key={`${r.target_id}-${i}`}
                    className="flex items-center gap-2 text-xs text-gray-600"
                  >
                    <span className="w-5 text-center font-semibold text-gray-400">
                      {r.rank_in_category}
                    </span>
                    <span className="flex-1 truncate">{r.target_name}</span>
                    <span className="text-gray-500">
                      {r.votes_count} vote{Number(r.votes_count) === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )

        if (collapsible) {
          return (
            <div key={cat.id} className="bg-white rounded-2xl overflow-hidden">
              <button
                onClick={() => toggle(cat.id)}
                className="w-full p-3.5 text-left active:scale-[0.99] transition-all"
              >
                {Header}
              </button>
              {isOpen && <div className="px-3.5 pb-3.5 space-y-2">{Body}</div>}
            </div>
          )
        }

        return (
          <div key={cat.id} className="bg-white rounded-2xl p-3.5 space-y-2">
            {Header}
            {Body}
          </div>
        )
      })}
    </div>
  )
}
