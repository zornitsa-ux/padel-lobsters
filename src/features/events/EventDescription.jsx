import React, { useEffect, useState } from 'react'
import { Pencil, Check } from 'lucide-react'

// ─── Event description block ──────────────────────────────────────────────
// Read-only card for players. For admins, clicking the pencil swaps the
// block for a textarea with Save / Cancel so copy tweaks don't require
// opening the full event-edit form. An empty description is still shown
// to admins (as a "+ Add description" prompt) so they can start one on
// the spot without leaving the page.
export default function EventDescription({ tournament, isAdmin, onSave }) {
  const original = tournament.notes || ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(original)
  const [saving, setSaving] = useState(false)

  // Keep the draft in sync if the tournament changes while this page is
  // mounted (e.g. realtime update from another admin).
  useEffect(() => {
    if (!editing) setDraft(original)
  }, [original, editing])

  const hasText = original.trim().length > 0

  const startEdit = () => {
    setDraft(original)
    setEditing(true)
  }
  const cancel = () => {
    setDraft(original)
    setEditing(false)
  }
  const save = async () => {
    if (draft === original) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 space-y-2">
        <textarea
          autoFocus
          className="input resize-none w-full text-sm leading-relaxed"
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What should players know about this event?"
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-xs font-semibold text-gray-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-lobster-teal active:scale-95 transition-all flex items-center gap-1"
          >
            <Check size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  // Not editing. Hide completely for non-admins when there's no content.
  if (!hasText && !isAdmin) return null

  return (
    <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100 relative">
      {hasText ? (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line pr-7">
          {tournament.notes}
        </p>
      ) : (
        <p className="text-sm text-gray-400 italic pr-7">No description yet.</p>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={startEdit}
          aria-label="Edit description"
          className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-lobster-teal hover:bg-white active:scale-95 transition-all"
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  )
}
