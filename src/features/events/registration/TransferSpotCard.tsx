import { ArrowRightLeft, Clock } from 'lucide-react'
import type { NormalisedRegistration } from '../registrationQueries'
import type { NormalisedTransfer } from '../transferQueries'
import type { GetPlayer, TransferShareTarget } from './utils'

interface TransferSpotCardProps {
  myReg: NormalisedRegistration | null | undefined
  pendingFromMe: NormalisedTransfer | undefined
  incomingForMe: NormalisedTransfer[]
  /** Transfer id currently being acted on, if any. */
  respondingTo: string | null
  onStartTransfer: (reg: NormalisedRegistration) => void
  onCancelMyOffer: () => void
  onOpenShareModal: (target: TransferShareTarget) => void
  onIncomingResponse: (xfer: NormalisedTransfer, accept: boolean) => void
  getPlayer: GetPlayer
}

/**
 * The player's own transfer affordances on the Info tab: incoming spot
 * offers (regardless of the viewer's own registration status) plus, for a
 * registered player, either the pending-offer notice or the button to start
 * one. Registration status and payment live on /me now — this card only
 * ever shows the transfer flow.
 */
export default function TransferSpotCard({
  myReg,
  pendingFromMe,
  incomingForMe,
  respondingTo,
  onStartTransfer,
  onCancelMyOffer,
  onOpenShareModal,
  onIncomingResponse,
  getPlayer,
}: TransferSpotCardProps) {
  const incomingCards =
    incomingForMe.length > 0 ? (
      <div className="space-y-2">
        {incomingForMe.map((xfer) => {
          const fromP = getPlayer(xfer.fromPlayerId)
          const fromFirst = (fromP?.name || '').split(/\s+/)[0] || 'Someone'
          const busy = respondingTo === xfer.id
          return (
            <div key={xfer.id} className="card border border-amber-300 bg-amber-50 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={14} className="text-amber-700 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>{fromFirst}</strong> wants to give you their spot
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onIncomingResponse(xfer, false)}
                  disabled={busy}
                  className="flex-1 border border-gray-300 text-lob-slate font-semibold py-2 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? 'Declining…' : 'Decline'}
                </button>
                <button
                  onClick={() => onIncomingResponse(xfer, true)}
                  disabled={busy}
                  className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? 'Accepting…' : 'Accept spot'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    ) : null

  if (!myReg) return incomingCards

  if (pendingFromMe) {
    const recipient = getPlayer(pendingFromMe.toPlayerId)
    const recipientFirst = (recipient?.name || '').split(/\s+/)[0] || 'them'
    const busy = respondingTo === pendingFromMe.id
    return (
      <>
        {incomingCards}
        <div className="card">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <Clock size={12} className="flex-shrink-0" />
              <span>Transfer offer pending · waiting on {recipientFirst}</span>
            </div>
            <div className="flex gap-2">
              {recipient && (
                <button
                  onClick={() =>
                    onOpenShareModal({ transferId: pendingFromMe.id, toPlayer: recipient })
                  }
                  className="flex-1 text-xs font-semibold text-green-700 bg-white border border-green-600 rounded-lg py-1.5 active:scale-95 transition-all"
                >
                  Resend WhatsApp
                </button>
              )}
              <button
                onClick={onCancelMyOffer}
                disabled={busy}
                className="flex-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg py-1.5 active:scale-95 transition-all disabled:opacity-50"
              >
                {busy ? 'Cancelling…' : 'Cancel offer'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Already given away — nothing left to offer.
  if (myReg.paymentStatus === 'transferred') return incomingCards

  return (
    <>
      {incomingCards}
      <div className="card">
        <button
          onClick={() => onStartTransfer(myReg)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-lob-muted border border-gray-200 rounded-xl py-1.5 font-medium active:scale-95 transition-all"
        >
          <ArrowRightLeft size={12} /> Transfer spot to another player
        </button>
      </div>
    </>
  )
}
