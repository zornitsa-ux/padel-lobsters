import React, { useState } from 'react'
import { Trash2, Plus, ChevronDown } from 'lucide-react'
import MoveButtons from './MoveButtons'
import LobsterWayAdminItem, { emptyItem } from './LobsterWayAdminItem'
import { moveItem, removeAt, replaceAt } from '../../../lib/arrayReorder'
import type { LobsterWayCategory, LobsterWayItem } from '../../../data/lobsterWayContent'

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
    <div className="card">
      <div className="flex items-center gap-2">
        <MoveButtons index={index} count={count} onMove={onMove} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-bold text-gray-700 truncate">
            {category.chipEmoji} {category.label || 'Untitled category'}
          </span>
          <ChevronDown
            size={15}
            className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete category"
          className="text-gray-300 hover:text-red-500 flex-shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
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
              {(category.items || []).map((item, i) => (
                <LobsterWayAdminItem
                  key={i}
                  item={item}
                  index={i}
                  count={(category.items ?? []).length}
                  onChange={(next) => setItem(i, next)}
                  onMove={(dir) => moveItemAt(i, dir)}
                  onDelete={() => deleteItemAt(i)}
                />
              ))}
              <button
                type="button"
                onClick={addItem}
                className="text-xs text-lob-teal font-semibold flex items-center gap-1"
              >
                <Plus size={12} /> Add question
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
