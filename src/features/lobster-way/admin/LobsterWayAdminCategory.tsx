import React, { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import MoveButtons from './MoveButtons'
import LobsterWayAdminItem, { emptyItem } from './LobsterWayAdminItem'
import { moveItem, removeAt, replaceAt } from '../../../lib/arrayReorder'
import type { LobsterWayCategory, LobsterWayItem } from '../../../data/lobsterWayContent'
import { CollapsibleCard } from '../../../components/ui/CollapsibleCard'
import { ListCard, ListRow } from '../../../components/ui/ListCard'
import { IconButton } from '../../../components/ui/IconButton'
import { TextButton } from '../../../components/ui/TextButton'

// One category editor: label/emoji, the origin-story toggle, and (for
// non-story categories) the list of question editors underneath.
export default function LobsterWayAdminCategory({
  category,
  index,
  count,
  onChange,
  onMove,
  onDelete,
}: {
  category: LobsterWayCategory
  index: number
  count: number
  onChange: (next: LobsterWayCategory) => void
  onMove: (direction: number) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  const set = (patch: Partial<LobsterWayCategory>) => onChange({ ...category, ...patch })

  const setItem = (i: number, next: LobsterWayItem) =>
    set({ items: replaceAt(category.items ?? [], i, next) })
  const moveItemAt = (i: number, dir: number) =>
    set({ items: moveItem(category.items ?? [], i, dir) })
  const deleteItemAt = (i: number) => set({ items: removeAt(category.items ?? [], i) })
  const addItem = () => set({ items: [...(category.items || []), emptyItem()] })

  return (
    <CollapsibleCard
      className="card space-y-3"
      expanded={open}
      onToggle={() => setOpen((o) => !o)}
      leading={<MoveButtons index={index} count={count} onMove={onMove} />}
      actions={
        <IconButton
          onClick={onDelete}
          aria-label="Delete category"
          variant="ghost-destructive"
          size="sm"
        >
          <Trash2 />
        </IconButton>
      }
      header={
        <span className="text-sm font-bold text-lob-slate truncate">
          {category.chipEmoji} {category.label || 'Untitled category'}
        </span>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="w-16 flex-shrink-0">
            <label className="label">Emoji</label>
            <input
              className="input text-sm text-center"
              value={category.chipEmoji || ''}
              onChange={(e) => set({ chipEmoji: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="label">Category name</label>
            <input
              className="input text-sm"
              value={category.label}
              onChange={(e) => set({ label: e.target.value })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={!!category.isStory}
            onChange={(e) =>
              set(
                e.target.checked
                  ? { isStory: true, story: category.story || '', items: undefined }
                  : { isStory: false, story: undefined, items: category.items || [] },
              )
            }
          />
          This is the Origin story block (plain text, not a Q&A list)
        </label>

        {category.isStory ? (
          <div>
            <label className="label">Story text</label>
            <textarea
              className="input text-sm min-h-[90px]"
              value={category.story || ''}
              onChange={(e) => set({ story: e.target.value })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <ListCard inset>
              {(category.items || []).map((item, i) => (
                <ListRow key={i}>
                  <LobsterWayAdminItem
                    item={item}
                    index={i}
                    count={(category.items ?? []).length}
                    onChange={(next) => setItem(i, next)}
                    onMove={(dir) => moveItemAt(i, dir)}
                    onDelete={() => deleteItemAt(i)}
                  />
                </ListRow>
              ))}
            </ListCard>
            <TextButton icon={<Plus size={12} />} onClick={addItem}>
              Add question
            </TextButton>
          </div>
        )}
      </div>
    </CollapsibleCard>
  )
}

export function emptyCategory(): LobsterWayCategory {
  return {
    slug: `category-${Date.now()}`,
    label: '',
    chipEmoji: '🦞',
    items: [],
  }
}
