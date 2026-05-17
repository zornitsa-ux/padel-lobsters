import React from 'react'
import { ArrowRightLeft, Clock } from 'lucide-react'

// ── Pending transfers ──────────────────────────────────
//     Both incoming offers (someone wants to transfer to me) and
//     outgoing pending offers (I'm waiting on someone to accept).
//     Sourced from registration_transfers via AppContext — survives
//     page reloads.
export default function TransferOfferBanners({
  incomingTransfers,
  outgoingTransfers,
  players,
  tournaments,
  transferBusy,
  onIncomingResponse,
  onOutgoingCancel,
  onOutgoingShare,
}) {
  if (incomingTransfers.length === 0 && outgoingTransfers.length === 0) return null
  return (
    <div className="space-y-2">
      {incomingTransfers.map((xfer) => {
        const fromP = players.find((p) => String(p.id) === String(xfer.fromPlayerId))
        const t = tournaments.find((t) => String(t.id) === String(xfer.tournamentId))
        const fromFirst = (fromP?.name || '').split(/\s+/)[0] || 'Someone'
        const busy = transferBusy === xfer.id
        return (
          <div key={xfer.id} className="card border border-amber-300 bg-amber-50 space-y-2">
            <div className="flex items-start gap-2">
              <ArrowRightLeft size={14} className="text-amber-700 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-900">
                  <strong>{fromFirst}</strong> wants to transfer their spot to you
                </p>
                {t && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    {t.name}
                    {t.date &&
                      ` · ${new Date(t.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onIncomingResponse(xfer, false)}
                disabled={busy}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Declining…' : 'Decline'}
              </button>
              <button
                onClick={() => onIncomingResponse(xfer, true)}
                disabled={busy}
                className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          </div>
        )
      })}
      {outgoingTransfers.map((xfer) => {
        const toP = players.find((p) => String(p.id) === String(xfer.toPlayerId))
        const t = tournaments.find((t) => String(t.id) === String(xfer.tournamentId))
        const toFirst = (toP?.name || '').split(/\s+/)[0] || 'them'
        const busy = transferBusy === xfer.id
        return (
          <div key={xfer.id} className="card border border-amber-200 bg-amber-50/60 space-y-2">
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-amber-700 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-900">
                  <strong>Pending transfer</strong> to {toFirst} — awaiting acceptance.
                </p>
                {t && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    {t.name}
                    {t.date &&
                      ` · ${new Date(t.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onOutgoingShare(xfer, toP)}
                disabled={busy || !toP}
                className="flex-1 text-xs font-semibold text-green-700 bg-white border border-green-600 rounded-xl py-2 active:scale-95 transition-all disabled:opacity-50"
              >
                Resend WhatsApp
              </button>
              <button
                onClick={() => onOutgoingCancel(xfer)}
                disabled={busy}
                className="flex-1 text-xs font-semibold text-red-600 border border-red-200 rounded-xl py-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {busy ? 'Cancelling…' : 'Cancel offer'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
