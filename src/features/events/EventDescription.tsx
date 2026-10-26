import { useEffect, useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import type { NormalisedTournament } from './tournamentQueries'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'

interface EventDescriptionProps {
  tournament: NormalisedTournament
  isAdmin: boolean
  onSave: (notes: string) => void | Promise<unknown>
}

// ─── Event description block ──────────────────────────────────────────────
// Read-only card for players. For admins, clicking the pencil swaps the
// block for a textarea with Save / Cancel so copy tweaks don't require
// opening the full event-edit form. An empty description is still shown
// to admins (as a "+ Add description" prompt) so they can start one on
// the spot without leaving the page.
export default function EventDescription({ tournament, isAdmin, onSave }: EventDescriptionProps) {
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
      <div className="card space-y-2">
        <textarea
          autoFocus
          className="input resize-none w-full text-sm leading-relaxed"
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What should players know about this event?"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="neutral" size="sm" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" icon={<Check />} onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  // Not editing. Hide completely for non-admins when there's no content.
  if (!hasText && !isAdmin) return null

  return (
    <div className="card relative">
      {hasText ? (
        <p className="text-sm text-lob-slate leading-relaxed whitespace-pre-line pr-8">
          {tournament.notes}
        </p>
      ) : (
        <p className="text-sm text-lob-muted-light italic pr-8">No description yet.</p>
      )}
      {isAdmin && (
        <IconButton
          onClick={startEdit}
          aria-label="Edit description"
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1"
        >
          <Pencil />
        </IconButton>
      )}
    </div>
  )
}
