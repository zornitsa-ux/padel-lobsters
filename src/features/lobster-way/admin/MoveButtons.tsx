import React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

// Up/down reorder controls, disabled at the ends of the list.
export default function MoveButtons({
  index,
  count,
  onMove,
}: {
  index: number
  count: number
  onMove: (direction: number) => void
}) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <button
        type="button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="text-gray-300 hover:text-lob-teal disabled:opacity-30 disabled:hover:text-gray-300"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        className="text-gray-300 hover:text-lob-teal disabled:opacity-30 disabled:hover:text-gray-300"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
