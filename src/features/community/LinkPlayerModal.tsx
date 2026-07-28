import React from 'react'
import Avatar from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import type { CommunityPlayer } from './playersSelectors'

interface LinkPlayerModalProps {
  /** The pending signup being linked; null keeps the modal closed. */
  linkModal: CommunityPlayer | null
  linkSearch: string
  setLinkSearch: (value: string) => void
  activePlayers: CommunityPlayer[]
  onClose: () => void
  onConfirm: (player: CommunityPlayer) => void
}

export default function LinkPlayerModal({
  linkModal,
  linkSearch,
  setLinkSearch,
  activePlayers,
  onClose,
  onConfirm,
}: LinkPlayerModalProps) {
  if (!linkModal) return null
  return (
    <Modal open onClose={onClose} title="Link to existing player">
      <div className="space-y-3">
        <p className="text-xs text-lob-muted -mt-2">
          Who is <strong>{linkModal.name}</strong> in the system?
        </p>

        <input
          type="text"
          placeholder="🔍 Search existing players…"
          value={linkSearch}
          onChange={(e) => setLinkSearch(e.target.value)}
          className="input"
          autoFocus
        />

        <div className="space-y-2">
          {activePlayers
            .filter((p) => (p.name || '').toLowerCase().includes(linkSearch.toLowerCase()))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => onConfirm(p)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-lob-cream active:scale-[0.98] transition-all text-left"
              >
                <Avatar player={p} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-lob-dark">{p.name}</p>
                  <p className="text-xs text-lob-muted">
                    Lv {(p.playtomicLevel || 0).toFixed(1)}
                    {p.email && ` · ${p.email}`}
                  </p>
                </div>
              </button>
            ))}
        </div>

        <p className="text-xs text-lob-muted-light text-center pt-1">
          This will merge {linkModal.name}'s new contact info onto the existing profile and send
          them their PIN.
        </p>
      </div>
    </Modal>
  )
}
