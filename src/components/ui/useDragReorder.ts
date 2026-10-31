import { useState, type DragEvent } from 'react'

export interface DragRowHandlers {
  /** This row is the one being dragged. */
  dragging: boolean
  /** Another row is over this one: dropping here moves it to this place. */
  dropTarget: boolean
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}

/** Moves the item at `from` to `to`, returning a new array. */
export function moveItem<T>({
  items,
  from,
  to,
}: {
  items: readonly T[]
  from: number
  to: number
}) {
  const reordered = [...items]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  return reordered
}

/** Drag-to-reorder state for a list of `DragRow`s: spread `rowProps(index)` on each row. */
export function useDragReorder({
  onMove,
}: {
  onMove: (move: { from: number; to: number }) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const reset = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  const rowProps = (index: number): DragRowHandlers => ({
    dragging: dragIndex === index,
    dropTarget: dragIndex !== null && dragIndex !== index && overIndex === index,
    onDragStart: (e) => {
      setDragIndex(index)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (index !== overIndex) setOverIndex(index)
    },
    onDrop: (e) => {
      e.preventDefault()
      const from = dragIndex
      reset()
      if (from !== null && from !== index) onMove({ from, to: index })
    },
    onDragEnd: reset,
  })

  return { rowProps }
}
