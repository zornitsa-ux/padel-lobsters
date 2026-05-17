import React from 'react'
import { Check } from 'lucide-react'

/* ─── Player: home tile grid ──────────────────────────────────────────── */
export default function CategoryGrid({
  categories,
  myVoteByCat,
  onSelect,
  showWaitingState = false,
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {categories.map((c) => {
        const voted = myVoteByCat[c.id]
        const clickable = !!onSelect
        return (
          <button
            key={c.id}
            disabled={!clickable}
            onClick={() => onSelect && onSelect(c.id)}
            className={`rounded-2xl p-3 text-left transition-all min-h-[112px] flex flex-col justify-between border ${
              voted
                ? 'bg-gray-100 border-gray-200'
                : clickable
                  ? 'bg-white border-gray-100 active:scale-95'
                  : 'bg-white border-gray-100 opacity-90'
            }`}
          >
            <span className="text-2xl">{c.icon}</span>
            <div>
              <p
                className={`font-bold text-sm leading-tight ${voted ? 'text-gray-600' : 'text-gray-800'}`}
              >
                {c.name}
              </p>
              {voted ? (
                <p className="text-[11px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                  <Check size={11} /> Voted: {voted.name}
                  {clickable && (
                    <span className="text-gray-400 font-normal ml-0.5">· tap to change</span>
                  )}
                </p>
              ) : showWaitingState ? (
                <p className="text-[11px] text-gray-400 font-medium mt-1">You didn&apos;t vote</p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1">Tap to vote</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
