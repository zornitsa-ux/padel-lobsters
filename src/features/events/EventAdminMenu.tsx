import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'

// Shared admin-tools overflow menu for a tournament. Renders nothing for
// non-admins. Each action is optional — pass only the handlers the surface
// needs, and the matching item appears. Dependency-free dropdown: a fixed
// transparent backdrop catches outside clicks.
//
// Raffle, eligibility, payments and scores moved to /manage's tabs/sections
// (EventManage.tsx) — this menu now only carries Edit/Delete.
interface EventAdminMenuProps {
  isAdmin: boolean
  onEdit?: () => void
  onDelete?: () => void
  align?: 'left' | 'right'
}

interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
  danger?: boolean
}

export default function EventAdminMenu({
  isAdmin,
  onEdit = undefined,
  onDelete = undefined,
  align = 'right',
}: EventAdminMenuProps) {
  const [open, setOpen] = useState(false)
  if (!isAdmin) return null

  const items = [
    onEdit && { key: 'edit', label: 'Edit event', icon: Pencil, onClick: onEdit },
    onDelete && {
      key: 'delete',
      label: 'Delete event',
      icon: Trash2,
      onClick: onDelete,
      danger: true,
    },
  ].filter((it): it is MenuItem => Boolean(it))

  if (items.length === 0) return null

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative flex-shrink-0">
      <IconButton
        onClick={() => setOpen((v) => !v)}
        aria-label="Admin tools"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </IconButton>

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
                  it.danger ? 'text-red-600 hover:bg-red-50' : 'text-lob-slate hover:bg-gray-50'
                }`}
              >
                <it.icon
                  size={16}
                  className={it.danger ? 'text-red-500' : 'text-lob-muted-light'}
                />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
