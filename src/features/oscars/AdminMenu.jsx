import React, { useState } from 'react'
import { Settings, X, Gamepad2, SlidersHorizontal } from 'lucide-react'

/* ════════════════════════════════════════════════════════════════════════════
   AdminMenu — header trigger + slide-over for registered admins. Lets an admin
   who is also playing flip between casting their own votes ("Play") and the
   admin controls ("Admin controls"). Only mounted when the viewer can toggle
   (admin AND registered for this tournament); plain admins never see it.
   ════════════════════════════════════════════════════════════════════════════ */
export default function AdminMenu({ viewMode, onSetViewMode }) {
  const [open, setOpen] = useState(false)

  const select = (mode) => {
    onSetViewMode(mode)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 active:scale-95 transition-all"
        aria-label="Open admin menu"
      >
        <Settings size={15} /> Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative ml-auto h-full w-72 max-w-[85%] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">Admin menu</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400 px-1">
                View
              </p>
              <MenuOption
                active={viewMode === 'play'}
                icon={<Gamepad2 size={18} />}
                title="Play & vote"
                subtitle="Cast your own votes as a participant."
                onClick={() => select('play')}
              />
              <MenuOption
                active={viewMode === 'admin'}
                icon={<SlidersHorizontal size={18} />}
                title="Admin controls"
                subtitle="Start, monitor, end and share the games."
                onClick={() => select('admin')}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MenuOption({ active, icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all active:scale-[0.99] ${
        active
          ? 'bg-lobster-teal/10 border-lobster-teal'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className={active ? 'text-lobster-teal' : 'text-gray-500'}>{icon}</span>
      <span className="min-w-0">
        <span
          className={`block text-sm font-bold ${active ? 'text-lobster-teal' : 'text-gray-800'}`}
        >
          {title}
          {active && <span className="ml-1.5 text-[10px] font-semibold uppercase">· current</span>}
        </span>
        <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>
      </span>
    </button>
  )
}
