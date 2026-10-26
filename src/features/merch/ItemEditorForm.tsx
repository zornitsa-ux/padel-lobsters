import React, { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Upload, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { SIZES_APPAREL, SIZES_SOCKS } from './sizes'
import type { ItemFormState } from './itemForm'
import type { MerchItem } from './merchSchemas'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Chip, ChipGroup } from '../../components/ui/Chip'

type ItemEditorFormProps = {
  showForm: boolean
  setShowForm: (open: boolean) => void
  editItem: MerchItem | null
  form: ItemFormState
  setForm: Dispatch<SetStateAction<ItemFormState>>
  saving: boolean
  uploading: boolean
  handleSaveItem: (e: FormEvent<HTMLFormElement>) => void
  handleImageUpload: (e: ChangeEvent<HTMLInputElement>) => void
  handleRemoveImage: (idx: number) => void
  toggleSize: (size: string) => void
}

// ── Add / Edit item modal form (admin) ──────────────────────────────────────
export default function ItemEditorForm({
  showForm,
  setShowForm,
  editItem,
  form,
  setForm,
  saving,
  uploading,
  handleSaveItem,
  handleImageUpload,
  handleRemoveImage,
  toggleSize,
}: ItemEditorFormProps) {
  return (
    <Modal
      open={showForm}
      onClose={() => setShowForm(false)}
      title={editItem ? 'Edit Item' : 'Add Merch Item'}
      dismissible={false}
      footer={
        <ActionRow>
          <Button
            onClick={() => setShowForm(false)}
            disabled={saving || uploading}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button type="submit" form="item-editor-form" disabled={saving || uploading}>
            {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
          </Button>
        </ActionRow>
      }
    >
      <form id="item-editor-form" onSubmit={handleSaveItem} className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input
            required
            className="input"
            placeholder="e.g. Technical T-Shirt"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Description</label>
          <input
            className="input"
            placeholder="Short description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Price (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="0.00"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>

        {/* Offline orders — e.g. people who bought in person or via
              WhatsApp. Added to the live website count in the shop
              FOMO badge so players see the real demand. */}
        <div>
          <label className="label">
            Offline orders{' '}
            <span className="text-lob-muted-light font-normal">(bought outside the app)</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            className="input"
            placeholder="0"
            value={form.external_orders ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, external_orders: e.target.value }))}
          />
          <p className="text-xs text-lob-muted-light mt-1">
            Counts toward the "X lobsters already ordered" badge players see in the shop.
          </p>
        </div>

        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="apparel">Apparel</option>
            <option value="accessories">Accessories</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Sizes */}
        <div>
          <label className="label">Sizes (select applicable)</label>
          <div className="space-y-2">
            <ChipGroup ariaLabel="Apparel sizes">
              {SIZES_APPAREL.map((s) => (
                <Chip key={s} selected={form.sizes.includes(s)} onClick={() => toggleSize(s)}>
                  {s}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup ariaLabel="Sock sizes">
              {SIZES_SOCKS.map((s) => (
                <Chip key={s} selected={form.sizes.includes(s)} onClick={() => toggleSize(s)}>
                  {s}
                </Chip>
              ))}
            </ChipGroup>
            {form.sizes.length === 0 && (
              <p className="text-xs text-lob-muted-light">No sizes = one-size item</p>
            )}
          </div>
        </div>

        {/* Images — up to 3 */}
        <div>
          <label className="label">
            Product Photos <span className="text-lob-muted-light font-normal">(up to 3)</span>
          </label>

          {/* Thumbnails row */}
          {(form.image_urls || []).length > 0 && (
            <div className="flex gap-2 mb-3">
              {(form.image_urls || []).map((url, idx) => (
                <div key={idx} className="relative w-24 h-24 flex-shrink-0">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover rounded-xl border border-lob-line-strong"
                  />
                  <IconButton
                    onClick={() => handleRemoveImage(idx)}
                    aria-label="Remove image"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1"
                  >
                    <X />
                  </IconButton>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">
                      main
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload button — only show if under 3 */}
          {(form.image_urls || []).length < 3 && (
            <label
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-lob-muted font-medium cursor-pointer transition-all hover:border-lob-teal hover:text-lob-teal ${uploading ? 'opacity-50' : ''}`}
            >
              <Upload size={16} />
              {uploading
                ? 'Uploading…'
                : `Add photo${(form.image_urls || []).length > 0 ? ` (${(form.image_urls || []).length}/3)` : ''}`}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={handleImageUpload}
              />
            </label>
          )}
        </div>
      </form>
    </Modal>
  )
}
