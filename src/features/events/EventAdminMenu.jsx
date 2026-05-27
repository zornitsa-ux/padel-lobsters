import React, { useState } from 'react'
import {
  MoreVertical,
  Gift,
  SlidersHorizontal,
  Wallet,
  ListOrdered,
  Pencil,
  Trash2,
} from 'lucide-react'

// Shared admin-tools overflow menu for a tournament. Renders nothing for
// non-admins. Each action is optional — pass only the handlers the surface
// needs, and the matching item appears. Dependency-free dropdown: a fixed
// transparent backdrop catches outside clicks.
export default function EventAdminMenu({
  isAdmin,
  onRaffle,
  onEligibility,
  onPayments,
  onScores,
  onEdit,
  onDelete,
  align = 'right',
}) {
  const [open, setOpen] = useState(false)
  if (!isAdmin) return null

  const items = [
    onRaffle && { key: 'raffle', label: 'Prize Raffle', icon: Gift, onClick: onRaffle },
    onEligibility && {
      key: 'eligibility',
      label: 'Manage eligibility',
      icon: SlidersHorizontal,
      onClick: onEligibility,
    },
    onPayments && { key: 'payments', label: 'Payments', icon: Wallet, onClick: onPayments },
    onScores && { key: 'scores', label: 'Scores', icon: ListOrdered, onClick: onScores },
    onEdit && { key: 'edit', label: 'Edit event', icon: Pencil, onClick: onEdit },
    onDelete && {
      key: 'delete',
      label: 'Delete event',
      icon: Trash2,
      onClick: onDelete,
      danger: true,
    },
  ].filter(Boolean)

  if (items.length === 0) return null

  const run = (fn) => {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Admin tools"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 active:scale-95"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className={`absolute z-50 mt-2 w-52 rounded-2xl bg-white shadow-xl border border-gray-100 py-1 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((it) => (
              <button
                key={it.key}
                role="menuitem"
                onClick={() => run(it.onClick)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-left active:bg-gray-50 ${
                  it.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <it.icon size={16} className={it.danger ? 'text-red-500' : 'text-gray-400'} />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
