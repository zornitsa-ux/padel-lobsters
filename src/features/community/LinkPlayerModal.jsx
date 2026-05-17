import React from 'react'
import { X } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'

export default function LinkPlayerModal({
  linkModal,
  linkSearch,
  setLinkSearch,
  activePlayers,
  onClose,
  onConfirm,
}) {
  if (!linkModal) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Link to existing player</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Who is <strong>{linkModal.name}</strong> in the system?
            </p>
          </div>
          <button onClick={onClose}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <input
          type="text"
          placeholder="🔍 Search existing players…"
          value={linkSearch}
          onChange={(e) => setLinkSearch(e.target.value)}
          className="input"
          autoFocus
        />

        <div className="overflow-y-auto flex-1 space-y-2">
          {activePlayers
            .filter((p) => p.name.toLowerCase().includes(linkSearch.toLowerCase()))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => onConfirm(p)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-lobster-cream active:scale-[0.98] transition-all text-left"
              >
                <Avatar player={p} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Lv {(p.adjustedLevel || 0).toFixed(1)}
                    {p.email && ` · ${p.email}`}
                  </p>
                </div>
              </button>
            ))}
        </div>

        <p className="text-xs text-gray-400 text-center pt-1">
          This will merge {linkModal.name}'s new contact info onto the existing profile and send
          them their PIN.
        </p>
      </div>
    </div>
  )
}
