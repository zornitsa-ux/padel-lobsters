import { ArrowRightLeft, Clock } from 'lucide-react'
import type { NormalisedRegistration } from '../registrationQueries'
import type { NormalisedTransfer } from '../transferQueries'
import type { GetPlayer, TransferShareTarget } from './utils'
import { TextButton } from '../../../components/ui/TextButton'
import { Button } from '../../../components/ui/Button'
import { OutgoingTransferActions, TransferResponseActions } from '../TransferActions'

interface TransferSpotCardProps {
  myReg: NormalisedRegistration | null | undefined
  pendingFromMe: NormalisedTransfer | undefined
  incomingForMe: NormalisedTransfer[]
  /** Transfer id currently being acted on, if any. */
  respondingTo: string | null
  /** True within 12h of tournament start — the "start a transfer" affordance
   *  is replaced with a closed notice. Doesn't affect pre-existing pending
   *  offers, which still render and let the server's own cutoff answer. */
  transfersClosed: boolean
  /** For the closed-notice's "reach out to the community admins" link. */
  whatsappLink?: string | null
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
  transfersClosed,
  whatsappLink,
  onStartTransfer,
  onCancelMyOffer,
  onOpenShareModal,
  onIncomingResponse,
  getPlayer,
}: TransferSpotCardProps) {
  const closedNotice = (
    <div className="card">
      <p className="text-xs text-lob-muted text-center py-1.5">
        Transfers are closed for this event. Reach out to the{' '}
        {whatsappLink ? (
          <TextButton href={whatsappLink} external size="inherit">
            community admins
          </TextButton>
        ) : (
          'community admins'
        )}{' '}
        for help.
      </p>
    </div>
  )
  const incomingCards =
    incomingForMe.length > 0 ? (
      <div className="space-y-2">
        {incomingForMe.map((xfer) => {
          const fromP = getPlayer(xfer.fromPlayerId)
          const fromFirst = (fromP?.name || '').split(/\s+/)[0] || 'Someone'
          const busy = respondingTo === xfer.id
          return (
            <div
              key={xfer.id}
              className="card border border-lob-warning-border bg-lob-warning-light space-y-3"
            >
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={14} className="text-lob-warning flex-shrink-0" />
                <p className="text-sm text-lob-warning-strong">
                  <strong>{fromFirst}</strong> wants to give you their spot
                </p>
              </div>
              <TransferResponseActions
                busy={busy}
                acceptLabel="Accept spot"
                onRespond={({ accept }) => onIncomingResponse(xfer, accept)}
              />
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
          <div className="bg-lob-warning-light border border-lob-warning-border rounded-xl px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-xs text-lob-warning-strong">
              <Clock size={12} className="flex-shrink-0" />
              <span>Transfer offer pending · waiting on {recipientFirst}</span>
            </div>
            <OutgoingTransferActions
              onResend={
                recipient
                  ? () => onOpenShareModal({ transferId: pendingFromMe.id, toPlayer: recipient })
                  : undefined
              }
              onCancel={onCancelMyOffer}
              busy={busy}
            />
          </div>
        </div>
      </>
    )
  }

  // Already given away — nothing left to offer.
  if (myReg.paymentStatus === 'transferred') return incomingCards

  if (transfersClosed) {
    return (
      <>
        {incomingCards}
        {closedNotice}
      </>
    )
  }

  return (
    <>
      {incomingCards}
      <div className="card">
        <Button
          variant="neutral"
          size="sm"
          fullWidth
          icon={<ArrowRightLeft />}
          onClick={() => onStartTransfer(myReg)}
        >
          Transfer spot to another player
        </Button>
      </div>
    </>
  )
}
