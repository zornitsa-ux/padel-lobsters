import React from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'

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
    <div className="flex">
      <IconButton
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        variant="ghost"
        size="sm"
      >
        <ArrowUp />
      </IconButton>
      <IconButton
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        variant="ghost"
        size="sm"
      >
        <ArrowDown />
      </IconButton>
    </div>
  )
}
