import React, { useState, useMemo } from 'react'
import { X, ArrowRightLeft, Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { letterColor } from '../lib/letterColors'

// Picker modal Josephine sees when she taps "Transfer spot to another player".
// Lists waitlist players first (so transferring to them is a one-tap promotion
// off the waitlist), then everyone else searchable. On confirm, calls
// createTransfer() which writes the pending row in registration_transfers.
//
// Props:
//   tournament:        the tournament object
//   onClose():         dismiss the modal without doing anything
//   onTransferCreated: ({ transferId, toPlayer }) => void
//                      called after the RPC returns 'ok' so the caller can
//                      open the share modal next.
export default function TransferSpotModal({ tournament, onClose, onTransferCreated }) {
  const {
    players, isAdmin, claimedId,
    getTournamentRegistrations, createTransfer,
  } = useApp()

  const [search, setSearch] = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState(null)

  const displayName = (p) => isAdmin ? p.name : (p.name || '').split(' ')[0]

  const regs = getTournamentRegistrations(tournament?.id)
  const registeredIds = regs.filter(r => r.status === 'registered').map(r => String(r.playerId))
  const waitlistedIds = regs.filter(r => r.status === 'waitlist').map(r => String(r.playerId))

  // Build the candidate list. Waitlisted players surface first (one-tap
  // promotion off the waitlist), then everyone else alphabetically. We
  // exclude players who currently hold a registered spot — they can't
  // receive a transfer, and we exclude the current user themselves.
  const candidates = useMemo(() => {
    const list = players
      .filter(p => (p.status || 'active') === 'active')
      .filter(p => String(p.id) !== String(claimedId))
      .filter(p => !registeredIds.includes(String(p.id)))
      .filter(p => !search ||
        (p.name || '').toLowerCase().includes(search.toLowerCase())
      )
    list.sort((a, b) => {
      const aw = waitlistedIds.includes(String(a.id)) ? 0 : 1
      const bw = waitlistedIds.includes(String(b.id)) ? 0 : 1
      if (aw !== bw) return aw - bw
      return (a.name || '').localeCompare(b.name || '')
    })
    return list
  }, [players, claimedId, registeredIds.join(','), waitlistedIds.join(','), search])

  const handlePick = async (toPlayer) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await createTransfer(toPlayer.id, tournament.id)
    setBusy(false)
    if (result.ok) {
      onTransferCreated?.({ transferId: result.transferId, toPlayer })
      return
    }
    // Map the RPC's status code to a human-readable error.
    const map = {
      wrong_pin:                 'Sign in again to send a transfer.',
      invalid_target:            'That player can\'t receive a transfer.',
      not_registered:            'You are no longer registered for this event.',
      target_already_registered: 'That player is already registered.',
      tournament_started:        'Too late — the event has already started.',
      already_pending:           'You already have a pending transfer for this event.',
      error:                     'Something went wrong. Try again.',
    }
    setError(map[result.status] || 'Could not send the transfer offer.')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Transfer your spot</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Pick who takes over. They'll be asked to accept — your spot stays
              held until they do.
            </p>
          </div>
          <button onClick={onClose} disabled={busy}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search player…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-2">
          {candidates.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No matching players found</p>
          )}
          {candidates.map(p => {
            const isWait = waitlistedIds.includes(String(p.id))
            return (
              <button
                key={p.id}
                onClick={() => handlePick(p)}
                disabled={busy}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-lobster-cream active:scale-[0.98] transition-all text-left disabled:opacity-40"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: letterColor(p.name) }}
                >
                  {(p.name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                    {displayName(p)}
                    {isWait && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        On waitlist
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Lv {(p.adjustedLevel || 0).toFixed(1)}</p>
                </div>
                <ArrowRightLeft size={14} className="text-lobster-teal flex-shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
