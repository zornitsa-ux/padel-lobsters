import { X, Plus } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'

/* A category row while it is being edited: the fields are still loose because
   they come either from a saved `lobster_oscars_categories` row (nullable
   columns) or from a blank row the admin just added. AdminView tightens them
   into OscarCategoryInput on submit. */
export interface EditableCategory {
  name?: string | null
  icon?: string | null
  display_order?: number | null
}

interface CategoryEditorProps {
  cats: EditableCategory[]
  onChange: (next: EditableCategory[]) => void
  onReset: () => void
}

/* ─── Admin: editable categories list ─────────────────────────────────── */
export default function CategoryEditor({ cats, onChange, onReset }: CategoryEditorProps) {
  const update = (i: number, patch: Partial<EditableCategory>) => {
    const next = cats.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    onChange(next)
  }
  const remove = (i: number) => {
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
        <div key={i} className="flex items-center gap-2 bg-lob-well rounded-xl px-2.5 py-2">
          <input
            type="text"
            value={c.icon || ''}
            onChange={(e) => update(i, { icon: e.target.value.slice(0, 4) })}
            className="w-10 text-center bg-white border border-lob-line-strong rounded-lg py-1.5 text-base"
            placeholder="🦞"
            aria-label="Category icon"
          />
          <input
            type="text"
            value={c.name || ''}
            onChange={(e) => update(i, { name: e.target.value })}
            className="flex-1 bg-white border border-lob-line-strong rounded-lg px-2.5 py-1.5 text-sm"
            placeholder="Category name"
            aria-label="Category name"
          />
          <IconButton
            onClick={() => remove(i)}
            aria-label="Remove category"
            variant="ghost-destructive"
            size="sm"
          >
            <X />
          </IconButton>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="secondary" grow icon={<Plus />} onClick={add}>
          Add category
        </Button>
        <TextButton tone="neutral" onClick={onReset}>
          Reset to defaults
        </TextButton>
      </div>
    </div>
  )
}
