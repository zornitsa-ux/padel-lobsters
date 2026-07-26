import React from 'react'
import { ArrowRightLeft, CheckCircle, Clock, X } from 'lucide-react'
import PaymentStatusBadge from './PaymentStatusBadge'
import Avatar from '../../../components/ui/Avatar'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import { IconButton } from '../../../components/ui/IconButton'

export default function RegisteredSection({
  isCompleted,
  getPlayer,
  registered,
  maxPlayers,
  isAdmin,
  displayName,
  onCancelRegistration,
  pendingByFromPlayerId,
  respondingTo,
  onOpenShareModal,
  onCancelMyOffer,
  onStartTransfer,
}) {
  if (isCompleted) return null

  return (
    <>
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

            if (!isAdmin) return null

            const canTransfer = true

            return (
              <div key={reg.id} className="card space-y-2">
                <PlayerRow
                  player={p}
                  prefix={
                    <span className="text-xs text-lob-muted w-5 text-center font-bold">
                      #{idx + 1}
                    </span>
                  }
                  name={displayName(p)}
                  subtitle={`Level ${(p.playtomicLevel || 0).toFixed(1)}`}
                  trailing={
                    <>
                      <PaymentStatusBadge paymentStatus={reg.paymentStatus} />
                      <IconButton
                        onClick={() => onCancelRegistration(reg)}
                        aria-label="Cancel registration"
                        variant="destructive"
                        size="sm"
                      >
                        <X size={14} />
                      </IconButton>
                    </>
                  }
                />

                {(() => {
                  const myPending = pendingByFromPlayerId.get(String(reg.playerId))
                  if (myPending) {
                    const recipient = getPlayer(myPending.toPlayerId)
                    const recipientFirst = (recipient?.name || '').split(/\s+/)[0] || 'them'
                    const isOwner = isAdmin
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
                return (
                  <div
                    key={reg.id}
                    className="bg-white border border-gray-200 rounded-xl px-2 py-1.5 flex items-center gap-2 min-w-0"
                  >
                    <Avatar player={p} size="sm" />
                    <span className="text-xs font-semibold text-lob-dark truncate flex-1">
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
