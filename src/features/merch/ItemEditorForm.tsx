import React, { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Upload } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { SIZES_APPAREL, SIZES_SOCKS } from './sizes'
import type { ItemFormState } from './itemForm'
import type { MerchItem } from './merchSchemas'

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            disabled={saving || uploading}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="item-editor-form"
            disabled={saving || uploading}
            className="btn-primary flex-1"
          >
            {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
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
            <span className="text-gray-400 font-normal">(bought outside the app)</span>
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
          <p className="text-[11px] text-gray-400 mt-1">
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
            <div className="flex flex-wrap gap-1.5">
              {SIZES_APPAREL.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSize(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lob-teal text-white border-lob-teal' : 'border-gray-200 text-gray-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SIZES_SOCKS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSize(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lob-teal text-white border-lob-teal' : 'border-gray-200 text-gray-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {form.sizes.length === 0 && (
              <p className="text-xs text-gray-400">No sizes = one-size item</p>
            )}
          </div>
        </div>

        {/* Images — up to 3 */}
        <div>
          <label className="label">
            Product Photos <span className="text-gray-400 font-normal">(up to 3)</span>
          </label>

          {/* Thumbnails row */}
          {(form.image_urls || []).length > 0 && (
            <div className="flex gap-2 mb-3">
              {(form.image_urls || []).map((url, idx) => (
                <div key={idx} className="relative w-24 h-24 flex-shrink-0">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover rounded-xl border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold leading-none"
                  >
                    ×
                  </button>
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
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 font-medium cursor-pointer transition-all hover:border-lob-teal hover:text-lob-teal ${uploading ? 'opacity-50' : ''}`}
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
