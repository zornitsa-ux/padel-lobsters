import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Save } from 'lucide-react'

// Section — collapsible info card, optionally editable inline by an admin
// (admin or league admin). When editable is true and the user taps the
// pencil icon in the header, the section body swaps for a textarea that
// calls onSave(newBody) on commit.
export default function Section({
  id,
  icon,
  title,
  children,
  defaultOpen,
  editable,
  currentBody,
  onSave,
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentBody ?? '')
  const [busy, setBusy] = useState(false)

  const startEdit = (e) => {
    e.stopPropagation()
    setDraft(currentBody ?? '')
    setEditing(true)
    setOpen(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setDraft(currentBody ?? '')
  }
  const commit = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onSave?.(draft)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-xl">{icon}</span>
        <span className="flex-1 font-bold text-gray-800 text-sm sm:text-base">{title}</span>
        {editable && !editing && (
          <span
            onClick={startEdit}
            className="text-lobster-teal p-1 hover:bg-lobster-cream rounded"
            title="Edit this section"
          >
            <Pencil size={14} />
          </span>
        )}
        {open ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-gray-100">
          {editing ? (
            <div className="space-y-2 pt-2">
              <textarea
                className="input font-mono text-xs"
                rows={Math.max(6, Math.min(20, (draft || '').split('\n').length + 1))}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write this section's body. Use **bold** for emphasis, blank lines for spacing, and bullet lines starting with • for lists."
              />
              <p className="text-[10px] text-gray-400">
                Supports <code>**bold**</code> and line breaks. Leave blank to revert to the
                default.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex-1 py-2 text-sm font-semibold text-gray-500 bg-gray-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={commit}
                  disabled={busy}
                  className="flex-1 py-2 text-sm font-bold text-white bg-lobster-teal rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Save size={12} /> {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}
