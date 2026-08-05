import React from 'react'
import { Link } from 'react-router-dom'
import { Info, ChevronRight } from 'lucide-react'

// Subtle "The Lobster way" entry point — a plain menu row (icon, title,
// subtitle, chevron). Used at the bottom of both Home and Account so it
// reads as a quiet reference link rather than a promoted feature.
export default function LobsterWayLink() {
  return (
    <Link
      to="/lobster-way"
      className="card flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Info size={16} className="text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-700 text-sm">The Lobster way</p>
        <p className="text-[11px] text-gray-400">Rules, perks, and how everything works</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </Link>
  )
}
