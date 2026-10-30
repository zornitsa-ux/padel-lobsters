import { ArrowRightLeft, CheckCircle, Clock, X } from 'lucide-react'
import PaymentStatusBadge from './PaymentStatusBadge'
import Avatar from '../../../components/ui/Avatar'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import { IconButton } from '../../../components/ui/IconButton'
import type { NormalisedRegistration } from '../registrationQueries'
import type { NormalisedTransfer } from '../transferQueries'
import type { DisplayName, GetPlayer, TransferShareTarget } from './utils'
import { Button } from '../../../components/ui/Button'
import { OutgoingTransferActions } from '../TransferActions'
import { AlertBox } from '../../../components/ui/AlertBox'

interface RegisteredSectionProps {
  isCompleted: boolean
  getPlayer: GetPlayer
  registered: NormalisedRegistration[]
  maxPlayers: number
  isAdmin: boolean
  displayName: DisplayName
  onCancelRegistration: (reg: NormalisedRegistration) => void
  /** Pending outgoing transfer per registration owner, keyed by String(playerId). */
  pendingByFromPlayerId: Map<string, NormalisedTransfer>
  /** Transfer id currently being acted on, if any. */
  respondingTo: string | null
  onOpenShareModal: (target: TransferShareTarget) => void
  /** Cancels a transfer started on someone else's registration — uses
   *  admin_cancel_transfer, since the admin isn't the transfer's from_player
   *  and the self-service cancel RPC would reject it. */
  onAdminCancelTransfer: (transferId: string) => void
  onStartTransfer: (reg: NormalisedRegistration) => void
}

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
  onAdminCancelTransfer,
  onStartTransfer,
}: RegisteredSectionProps) {
  if (isCompleted) return null

  return (
    <>
      <section>
        <h3 className="font-bold text-lob-slate mb-2 flex items-center gap-2">
          <CheckCircle size={16} className="text-lob-success-solid" />
          Registered ({registered.length}/{maxPlayers})
        </h3>
        <div className="space-y-2">
          {registered.length === 0 && (
            <p className="text-sm text-lob-muted-light card py-4 text-center">
              No players registered yet
            </p>
          )}

          {registered.map((reg, idx) => {
            const p = getPlayer(reg.playerId)
            if (!p) return null

            if (!isAdmin) return null

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
                        <X />
                      </IconButton>
                    </>
                  }
                />

                {(() => {
                  const myPending = pendingByFromPlayerId.get(String(reg.playerId))
                  if (myPending) {
                    const recipient = getPlayer(myPending.toPlayerId)
                    const recipientFirst = (recipient?.name || '').split(/\s+/)[0] || 'them'
                    return (
                      <AlertBox
                        variant="warning"
                        size="sm"
                        icon={<Clock />}
                        actions={
                          recipient && (
                            <OutgoingTransferActions
                              onResend={() =>
                                onOpenShareModal({ transferId: myPending.id, toPlayer: recipient })
                              }
                              onCancel={() => onAdminCancelTransfer(myPending.id)}
                              busy={respondingTo === myPending.id}
                            />
                          )
                        }
                      >
                        <strong>Pending transfer</strong> to {recipientFirst} — awaiting acceptance.
                      </AlertBox>
                    )
                  }

                  // A registration that arrived via a transfer can still be
                  // transferred onward — payment_status stays 'transferred' as a
                  // record of how the player got in, not a lock on the spot.
                  return (
                    <Button
                      variant="neutral"
                      size="sm"
                      fullWidth
                      icon={<ArrowRightLeft />}
                      onClick={() => onStartTransfer(reg)}
                    >
                      Transfer spot to another player
                    </Button>
                  )
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
                    className="bg-white border border-lob-line-strong rounded-xl px-2 py-1.5 flex items-center gap-2 min-w-0"
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
