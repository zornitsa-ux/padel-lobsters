import { useState, type DragEvent } from 'react'

export interface DragRowHandlers {
  /** This row is the one being dragged. */
  dragging: boolean
  /** Another row is over this one: dropping here moves it to this place. */
  dropTarget: boolean
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: (e: DragEvent<HTMLElement>) => void
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

/**
 * Drag-to-reorder state for a list of `DragRow`s: spread `rowProps(index)` on each row. `keys`
 * identify the rows in their current order, so a list that changes mid-drag still moves the
 * row that was picked up.
 */
export function useDragReorder<K>({
  keys,
  onMove,
}: {
  keys: readonly K[]
  onMove: (move: { from: number; to: number }) => void
}) {
  const [dragKey, setDragKey] = useState<K | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const dragIndex = dragKey === null ? -1 : keys.indexOf(dragKey)

  const reset = () => {
    setDragKey(null)
    setOverIndex(null)
  }

  const rowProps = (index: number): DragRowHandlers => ({
    dragging: dragIndex === index,
    dropTarget: dragIndex !== -1 && dragIndex !== index && overIndex === index,
    onDragStart: (e) => {
      setDragKey(keys[index])
      e.dataTransfer.effectAllowed = 'move'
    },
    // Only this list's rows: a file or text dragged over it is not a move.
    onDragOver: (e) => {
      if (dragIndex === -1) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (index !== overIndex) setOverIndex(index)
    },
    onDragLeave: (e) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setOverIndex((current) => (current === index ? null : current))
    },
    onDrop: (e) => {
      e.preventDefault()
      reset()
      if (dragIndex !== -1 && dragIndex !== index) onMove({ from: dragIndex, to: index })
    },
    onDragEnd: reset,
  })

  return { rowProps }
}
