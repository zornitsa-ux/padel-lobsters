import React, { useState } from 'react'
import { ArrowRightLeft, AlertTriangle, Clock } from 'lucide-react'
import { useApp } from '../context/useApp'
import { usePlayers } from '../features/players/usePlayers'
import { useTransfers, useTransferActions } from '../features/events/useTransfers'
import Avatar from './ui/Avatar'
import { Modal } from './ui/Modal'

// Admin-only modal that lists every pending transfer for a tournament and
// surfaces the two admin actions:
//   - Force accept (admin_force_accept_transfer): finalises the offer
//     without the recipient tapping accept. Used when the recipient can't
//     reach the app in time but has confirmed by other means.
//   - Cancel: closes the offer using the same cancel_transfer RPC the
//     from-player uses (admin's PIN doesn't apply here — this RPC needs
//     the from-player's PIN, so the action shows up disabled with a hint
//     when the admin isn't the from-player).
//
// Props:
//   tournament: tournament object whose pending transfers are listed
//   onClose():  dismiss the panel
export default function AdminTransferPanel({ tournament, onClose }) {
  const { session } = useApp()
  const { data: transfers = [] } = useTransfers()
  const { forceAcceptTransfer, adminCancelTransfer } = useTransferActions({ session })
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  const [busyId, setBusyId] = useState(null)
  const [errorById, setErrorById] = useState({})

  if (!isAdmin) return null

  const pending = transfers.filter(
    (t) => t.status === 'pending' && String(t.tournamentId) === String(tournament?.id),
  )

  const getPlayer = (id) => players.find((p) => String(p.id) === String(id))

  const formatElapsed = (createdAt) => {
    if (!createdAt) return ''
    const ms = Date.now() - new Date(createdAt).getTime()
    if (ms < 0) return 'just now'
    const m = Math.floor(ms / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  const handleForceAccept = async (xfer) => {
    if (
      !confirm(
        `Force-accept this transfer? The spot moves to ${getPlayer(xfer.toPlayerId)?.name || 'the recipient'}.`,
      )
    )
      return
    setBusyId(xfer.id)
    setErrorById((e) => ({ ...e, [xfer.id]: null }))
    const r = await forceAcceptTransfer(xfer.id)
    setBusyId(null)
    if (!r.ok) {
      const msg =
        {
          wrong_admin_pin: 'Admin PIN required. Sign in as admin in Settings.',
          not_found: 'Transfer no longer exists.',
          not_pending: 'Transfer was already responded to.',
          tournament_started: 'Too late — the event has already started.',
        }[r.status] || 'Could not force-accept the transfer.'
      setErrorById((e) => ({ ...e, [xfer.id]: msg }))
    }
  }

  const handleCancel = async (xfer) => {
    if (!confirm('Cancel this transfer offer? The spot stays with the from-player.')) return
    setBusyId(xfer.id)
    setErrorById((e) => ({ ...e, [xfer.id]: null }))
    const r = await adminCancelTransfer(xfer.id)
    setBusyId(null)
    if (!r.ok) {
      const msg =
        {
          wrong_admin_pin: 'Admin PIN required. Sign in as admin in Settings.',
          not_found: 'Transfer no longer exists.',
          not_pending: 'Transfer was already responded to.',
        }[r.status] || 'Could not cancel the transfer.'
      setErrorById((e) => ({ ...e, [xfer.id]: msg }))
    }
  }

  return (
    <Modal open onClose={onClose} title="Pending transfers">
      <div className="space-y-4">
        <p className="text-xs text-gray-400 -mt-2">{tournament?.name}</p>

        {pending.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No pending transfers for this event.
          </p>
        )}

        {pending.map((xfer) => {
          const fromP = getPlayer(xfer.fromPlayerId)
          const toP = getPlayer(xfer.toPlayerId)
          const busy = busyId === xfer.id
          const err = errorById[xfer.id]
          return (
            <div
              key={xfer.id}
              className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Avatar player={{ name: fromP?.name || '?' }} size="sm" />
                <div className="text-sm font-semibold text-lob-dark">{fromP?.name || '—'}</div>
                <ArrowRightLeft size={14} className="text-lob-muted" />
                <Avatar player={{ name: toP?.name || '?' }} size="sm" />
                <div className="flex-1 text-sm font-semibold text-lob-dark truncate">
                  {toP?.name || '—'}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                <Clock size={11} /> Sent {formatElapsed(xfer.createdAt)} · awaiting acceptance
              </div>

              {err && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 text-[11px] text-red-700 flex items-start gap-1">
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCancel(xfer)}
                  disabled={busy}
                  className="flex-1 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-lg py-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {busy ? '…' : 'Cancel offer'}
                </button>
                <button
                  onClick={() => handleForceAccept(xfer)}
                  disabled={busy}
                  className="flex-1 text-xs font-semibold text-amber-900 bg-amber-200 rounded-lg py-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {busy ? 'Working…' : 'Force accept'}
                </button>
              </div>
            </div>
          )
        })}

        <p className="text-[11px] text-gray-400 text-center pt-1">
          Force accept finalises the transfer immediately. The recipient's spot becomes registered,
          and the from-player's registration is cancelled.
        </p>
      </div>
    </Modal>
  )
}
