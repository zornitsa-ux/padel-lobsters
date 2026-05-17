import React from 'react'
import { Plus, Pencil, X, ShoppingBag, GripVertical } from 'lucide-react'

// ── Manage tab (admin) — drag-and-drop CRUD list of merch items ─────────────
export default function AdminItemManager({
  items,
  openAdd,
  openEdit,
  handleDeleteItem,
  orderCount,
  dragIdx,
  overIdx,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={openAdd}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Add Merch Item
      </button>

      {/* Item list (draggable) */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={handleDragStart(idx)}
            onDragOver={handleDragOver(idx)}
            onDrop={handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={`card flex items-center gap-3 transition-all ${
              dragIdx === idx ? 'opacity-40 scale-[0.97]' : ''
            } ${overIdx === idx && dragIdx !== idx ? 'ring-2 ring-lobster-teal ring-offset-1' : ''}`}
          >
            <div className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 text-gray-300 hover:text-gray-500 -ml-1">
              <GripVertical size={18} />
            </div>
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  className="w-full h-full object-cover"
                  alt=""
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag size={18} className="text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-500">
                €{parseFloat(item.price).toFixed(0)} · {orderCount(item.id)}{' '}
                {orderCount(item.id) === 1 ? 'order' : 'orders'}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => openEdit(item)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
              >
                <Pencil size={13} className="text-gray-500" />
              </button>
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"
              >
                <X size={13} className="text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
