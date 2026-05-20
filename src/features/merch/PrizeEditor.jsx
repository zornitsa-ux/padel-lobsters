import React, { useState, useEffect } from 'react'

// ── Inline prize editor for a single winner row ───────────────────────────────
// Click the prize text to edit. Empty value shows a neutral placeholder so
// admin always knows the field exists. Save on blur or Enter; Esc reverts.
export default function PrizeEditor({ winner, onSave }) {
  const initial = winner.prize || ''
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial)
  useEffect(() => {
    setValue(initial) /* sync when winner changes */
  }, [initial])
  const commit = async () => {
    setEditing(false)
    const trimmed = (value || '').trim()
    if (trimmed === (initial || '').trim()) return
    if (!winner.winnerId) return // not yet saved (RPC still in flight)
    await onSave(winner.winnerId, trimmed)
  }
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.target.blur()
          }
          if (e.key === 'Escape') {
            setValue(initial)
            setEditing(false)
          }
        }}
        className="mt-1 px-2 py-1 rounded-md border border-amber-300 bg-white/80 text-amber-900 text-sm sm:text-base font-semibold w-full max-w-xs"
        placeholder="e.g. tshirt, hat, sticker"
      />
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={`mt-1 text-sm sm:text-base font-semibold text-left ${winner.prize ? 'text-amber-900/80' : 'text-amber-900/40 italic'}`}
    >
      {winner.prize || '+ add prize'}
    </button>
  )
}
