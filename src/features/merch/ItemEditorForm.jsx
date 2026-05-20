import React from 'react'
import { X, Upload } from 'lucide-react'
import { SIZES_APPAREL, SIZES_SOCKS } from './sizes'

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
}) {
  if (!showForm) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">{editItem ? 'Edit Item' : 'Add Merch Item'}</h2>
          <button onClick={() => setShowForm(false)}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSaveItem} className="p-5 space-y-4">
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
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lobster-teal text-white border-lobster-teal' : 'border-gray-200 text-gray-600'}`}
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
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lobster-teal text-white border-lobster-teal' : 'border-gray-200 text-gray-600'}`}
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
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 font-medium cursor-pointer transition-all hover:border-lobster-teal hover:text-lobster-teal ${uploading ? 'opacity-50' : ''}`}
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

          <button type="submit" disabled={saving || uploading} className="btn-primary w-full">
            {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
          </button>
        </form>
      </div>
    </div>
  )
}
