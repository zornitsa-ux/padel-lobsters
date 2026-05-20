import React from 'react'
import { X, Plus } from 'lucide-react'

/* ─── Admin: editable categories list ─────────────────────────────────── */
export default function CategoryEditor({ cats, onChange, onReset }) {
  const update = (i, patch) => {
    const next = cats.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    onChange(next)
  }
  const remove = (i) => {
    const next = cats.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, display_order: idx }))
    onChange(next)
  }
  const add = () => {
    const next = [...cats, { name: '', icon: '🏆', display_order: cats.length }]
    onChange(next)
  }
  return (
    <div className="bg-white rounded-2xl p-3 space-y-2">
      {cats.map((c, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
          <input
            type="text"
            value={c.icon || ''}
            onChange={(e) => update(i, { icon: e.target.value.slice(0, 4) })}
            className="w-10 text-center bg-white border border-gray-200 rounded-lg py-1.5 text-base"
            placeholder="🦞"
            aria-label="Category icon"
          />
          <input
            type="text"
            value={c.name || ''}
            onChange={(e) => update(i, { name: e.target.value })}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
            placeholder="Category name"
            aria-label="Category name"
          />
          <button
            onClick={() => remove(i)}
            className="text-gray-300 hover:text-red-400 transition-colors p-1"
            aria-label="Remove category"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={add}
          className="flex-1 flex items-center justify-center gap-1 text-lobster-teal text-sm font-semibold bg-lobster-teal/5 hover:bg-lobster-teal/10 rounded-xl py-2 transition-colors"
        >
          <Plus size={14} /> Add category
        </button>
        <button
          onClick={onReset}
          className="text-gray-500 text-xs font-semibold px-3 hover:text-gray-700"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
