import React from 'react'
import { ArrowRightLeft, CheckCircle, Clock, ExternalLink, X } from 'lucide-react'
import { letterColor } from '../../../lib/letterColors'
import PaymentStatusBadge from './PaymentStatusBadge'

export default function RegisteredSection({
  isCompleted,
  incomingForMe,
  getPlayer,
  respondingTo,
  onIncomingResponse,
  registered,
  maxPlayers,
  claimedId,
  isAdmin,
  displayName,
  onCancelRegistration,
  hasTikkie,
  isAdminAll,
  tournamentTikkieLink,
  onMarkTikkied,
  pendingByFromPlayerId,
  onOpenShareModal,
  onCancelMyOffer,
  onStartTransfer,
}) {
  if (isCompleted) return null

  return (
    <>
      {incomingForMe.length > 0 &&
        incomingForMe.map((xfer) => {
          const fromP = getPlayer(xfer.fromPlayerId)
          const fromFirst = (fromP?.name || '').split(/\s+/)[0] || 'someone'
          const busy = respondingTo === xfer.id
          return (
            <div key={xfer.id} className="card border border-amber-300 bg-amber-50 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={14} className="text-amber-700" />
                <p className="text-sm text-amber-800">
                  <strong>{fromFirst}</strong> wants to transfer their spot to you.
                </p>
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

      <section>
        <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500" />
          Registered ({registered.length}/{maxPlayers})
        </h3>
        <div className="space-y-2">
          {registered.length === 0 && (
            <p className="text-sm text-gray-400 card py-4 text-center">No players registered yet</p>
          )}

          {registered.map((reg, idx) => {
            const p = getPlayer(reg.playerId)
            if (!p) return null

            const isMyReg = claimedId && String(claimedId) === String(reg.playerId)
            if (!isAdmin && !isMyReg) return null

            const canTransfer = isAdmin || isMyReg

            return (
              <div key={reg.id} className="card space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-center font-bold">
                    #{idx + 1}
                  </span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: letterColor(p.name) }}
                  >
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{displayName(p)}</p>
                    <p className="text-xs text-gray-400">
                      Level {(p.adjustedLevel || 0).toFixed(1)}
                    </p>
                  </div>
                  {isAdmin && <PaymentStatusBadge paymentStatus={reg.paymentStatus} />}
                  {isAdmin && (
                    <button
                      onClick={() => onCancelRegistration(reg)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95"
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  )}
                </div>

                {isMyReg && reg.paymentStatus === 'unpaid' && hasTikkie && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                    <span className="text-xs text-orange-700 flex-1">
                      Don&apos;t forget to pay! 💸
                    </span>
                    {isAdminAll && tournamentTikkieLink ? (
                      <a
                        href={tournamentTikkieLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onMarkTikkied(reg.id, reg.paymentStatus)}
                        className="inline-flex items-center gap-1 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0"
                      >
                        <ExternalLink size={11} /> Tikkie
                      </a>
                    ) : null}
                  </div>
                )}

                {(() => {
                  const myPending = pendingByFromPlayerId.get(String(reg.playerId))
                  if (myPending) {
                    const recipient = getPlayer(myPending.toPlayerId)
                    const recipientFirst = (recipient?.name || '').split(/\s+/)[0] || 'them'
                    const isOwner = isMyReg || isAdmin
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-amber-800">
                          <Clock size={12} className="flex-shrink-0" />
                          <span>
                            <strong>Pending transfer</strong> to {recipientFirst} — awaiting
                            acceptance.
                          </span>
                        </div>
                        {isOwner && recipient && (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                onOpenShareModal({ transferId: myPending.id, toPlayer: recipient })
                              }
                              className="flex-1 text-xs font-semibold text-green-700 bg-white border border-green-600 rounded-lg py-1.5 active:scale-95 transition-all"
                            >
                              Resend WhatsApp
                            </button>
                            <button
                              onClick={onCancelMyOffer}
                              disabled={respondingTo === myPending.id}
                              className="flex-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg py-1.5 active:scale-95 transition-all disabled:opacity-50"
                            >
                              {respondingTo === myPending.id ? 'Cancelling…' : 'Cancel offer'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (canTransfer && reg.paymentStatus !== 'transferred') {
                    return (
                      <button
                        onClick={() => onStartTransfer(reg)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-xl py-1.5 font-medium active:scale-95 transition-all"
                      >
                        <ArrowRightLeft size={12} /> Transfer spot to another player
                      </button>
                    )
                  }

                  return null
                })()}
              </div>
            )
          })}

          {!isAdmin && (
            <div className="grid grid-cols-2 gap-2">
              {registered.map((reg) => {
                const p = getPlayer(reg.playerId)
                if (!p) return null
                const isMyReg = claimedId && String(claimedId) === String(reg.playerId)
                if (isMyReg) return null
                return (
                  <div
                    key={reg.id}
                    className="bg-white border border-gray-200 rounded-xl px-2 py-1.5 flex items-center gap-2 min-w-0"
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: letterColor(p.name) }}
                      >
                        {p.name[0]}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-gray-800 truncate flex-1">
                      {displayName(p)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
