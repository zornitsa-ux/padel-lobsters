import React, { useState } from 'react'
import { Trash2, Plus, ChevronDown } from 'lucide-react'
import MoveButtons from './MoveButtons'
import { removeAt, replaceAt } from '../../../lib/arrayReorder'
import type {
  LobsterWayItem,
  LobsterWayListRow,
  LobsterWayStep,
} from '../../../data/lobsterWayContent'
import { IconButton } from '../../../components/ui/IconButton'
import { TextButton } from '../../../components/ui/TextButton'

const emptyListRow = (): LobsterWayListRow => ({ emoji: '', label: '', text: '' })
const emptyStepRow = (): LobsterWayStep => ({ title: '', text: '', image: '' })

// One question/answer editor: q, a, note, and the optional list/steps blocks.
// Collapsed to just the question text by default so a long category doesn't
// turn into a wall of open textareas.
export default function LobsterWayAdminItem({
  item,
  index,
  count,
  onChange,
  onMove,
  onDelete,
}: {
  item: LobsterWayItem
  index: number
  count: number
  onChange: (next: LobsterWayItem) => void
  onMove: (direction: number) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  const set = (patch: Partial<LobsterWayItem>) => onChange({ ...item, ...patch })

  const setListRow = (i: number, patch: Partial<LobsterWayListRow>) =>
    set({ list: replaceAt(item.list ?? [], i, { ...(item.list ?? [])[i], ...patch }) })
  const setStepRow = (i: number, patch: Partial<LobsterWayStep>) =>
    set({ steps: replaceAt(item.steps ?? [], i, { ...(item.steps ?? [])[i], ...patch }) })

  return (
    <div className="border border-lob-line rounded-xl bg-lob-well/60">
      <div className="flex items-center gap-2 px-3 py-2">
        <MoveButtons index={index} count={count} onMove={(dir) => onMove(dir)} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-medium text-gray-700 truncate">
            {item.q || 'Untitled question'}
          </span>
          <ChevronDown
            size={14}
            className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <IconButton
          onClick={onDelete}
          aria-label="Delete question"
          variant="ghost-destructive"
          size="sm"
        >
          <Trash2 />
        </IconButton>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <label className="label">Question (include an emoji if you want one)</label>
            <input
              className="input text-sm"
              value={item.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="🎾 What's a standard Lobster tournament?"
            />
          </div>
          <div>
            <label className="label">Answer</label>
            <textarea
              className="input text-sm min-h-[70px]"
              value={item.a || ''}
              onChange={(e) => set({ a: e.target.value })}
            />
          </div>
          <div>
            <label className="label">
              Closing paragraph (optional, shown after any list/steps)
            </label>
            <textarea
              className="input text-sm min-h-[50px]"
              value={item.note || ''}
              onChange={(e) => set({ note: e.target.value || undefined })}
            />
          </div>

          {/* Bulleted list block (perks, vote categories, profile fields...) */}
          {item.list ? (
            <div className="space-y-1.5 bg-white rounded-lg border border-lob-line p-2">
              <div className="flex items-center justify-between">
                <p className="label">Bullet list</p>
                <TextButton tone="neutral" onClick={() => set({ list: undefined })}>
                  Remove list
                </TextButton>
              </div>
              {item.list.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    className="input text-xs py-1 w-12 flex-shrink-0"
                    placeholder="🦞"
                    value={row.emoji || ''}
                    onChange={(e) => setListRow(i, { emoji: e.target.value })}
                  />
                  <input
                    className="input text-xs py-1 w-24 flex-shrink-0"
                    placeholder="Label"
                    value={row.label || ''}
                    onChange={(e) => setListRow(i, { label: e.target.value })}
                  />
                  <input
                    className="input text-xs py-1 flex-1"
                    placeholder="Text"
                    value={row.text || ''}
                    onChange={(e) => setListRow(i, { text: e.target.value })}
                  />
                  <IconButton
                    onClick={() => set({ list: removeAt(item.list ?? [], i) })}
                    aria-label="Delete row"
                    variant="ghost-destructive"
                    size="sm"
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              ))}
              <TextButton
                icon={<Plus size={11} />}
                onClick={() => set({ list: [...(item.list ?? []), emptyListRow()] })}
              >
                Add row
              </TextButton>
            </div>
          ) : (
            <TextButton icon={<Plus size={11} />} onClick={() => set({ list: [emptyListRow()] })}>
              Add bullet list
            </TextButton>
          )}

          {/* Numbered steps block (walkthroughs, e.g. transferring a spot) */}
          {item.steps ? (
            <div className="space-y-2 bg-white rounded-lg border border-lob-line p-2">
              <div className="flex items-center justify-between">
                <p className="label">Numbered steps</p>
                <TextButton tone="neutral" onClick={() => set({ steps: undefined })}>
                  Remove steps
                </TextButton>
              </div>
              {item.steps.map((step, i) => (
                <div key={i} className="space-y-1 border-b border-lob-line pb-2 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-gray-400 font-mono w-4 flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      className="input text-xs py-1 flex-1"
                      placeholder="Step title"
                      value={step.title || ''}
                      onChange={(e) => setStepRow(i, { title: e.target.value })}
                    />
                    <IconButton
                      onClick={() => set({ steps: removeAt(item.steps ?? [], i) })}
                      aria-label="Delete step"
                      variant="ghost-destructive"
                      size="sm"
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <textarea
                    className="input text-xs py-1 ml-6"
                    placeholder="Step text"
                    value={step.text || ''}
                    onChange={(e) => setStepRow(i, { text: e.target.value })}
                  />
                  <input
                    className="input text-xs py-1 ml-6"
                    placeholder="/lobster-way/image.png (optional)"
                    value={step.image || ''}
                    onChange={(e) => setStepRow(i, { image: e.target.value || undefined })}
                  />
                </div>
              ))}
              <TextButton
                icon={<Plus size={11} />}
                onClick={() => set({ steps: [...(item.steps ?? []), emptyStepRow()] })}
              >
                Add step
              </TextButton>
            </div>
          ) : (
            <TextButton icon={<Plus size={11} />} onClick={() => set({ steps: [emptyStepRow()] })}>
              Add numbered steps
            </TextButton>
          )}
        </div>
      )}
    </div>
  )
}

export function emptyItem(): LobsterWayItem {
  return { q: '', a: '' }
}
