import React from 'react'
import { Lightbulb } from 'lucide-react'

// ── Tip of the Day ────────────────────────────────────────
export default function TipOfTheDay({ tip }) {
  if (!tip) return null
  return (
    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
      <div className="w-9 h-9 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lightbulb size={17} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">
          Tip of the Day
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
        <p className="text-xs text-gray-400 italic mt-1.5">– ask Jon for more tips</p>
      </div>
    </div>
  )
}
