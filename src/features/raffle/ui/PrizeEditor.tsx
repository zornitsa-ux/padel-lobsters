import { useState, useEffect } from 'react'

interface Props {
  prize: string | null
  // null while the winner row hasn't been committed yet (no id to update).
  winnerId: string | null
  onSave: (winnerId: string, prize: string) => void
}

// Inline prize editor for a committed winner. Click to edit; Enter/blur saves,
// Esc reverts. Disabled (plain text) until the winner is recorded.
export default function PrizeEditor({ prize, winnerId, onSave }: Props) {
  const initial = prize || ''
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial)
  useEffect(() => {
    setValue(initial)
  }, [initial])

  if (!winnerId) {
    return <p className="mt-1 text-sm text-amber-900/40 italic">prize set after confirming</p>
  }

  const commit = () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed === initial.trim()) return
    onSave(winnerId, trimmed)
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
            ;(e.target as HTMLInputElement).blur()
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
      className={`mt-1 text-sm sm:text-base font-semibold text-left ${
        prize ? 'text-amber-900/80' : 'text-amber-900/40 italic'
      }`}
    >
      {prize || '+ add prize'}
    </button>
  )
}
