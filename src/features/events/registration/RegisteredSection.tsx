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
import { EmptyState } from '../../../components/ui/EmptyState'
import { ListCard, ListRow } from '../../../components/ui/ListCard'
import { Section } from '../../../components/ui/Section'

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
    <Section
      icon={<CheckCircle className="text-lob-success-solid" />}
      title={`Registered (${registered.length}/${maxPlayers})`}
    >
      {registered.length === 0 && <EmptyState variant="inline" title="No players registered yet" />}

      {isAdmin && registered.length > 0 && (
        <ListCard>
          {registered.map((reg, idx) => {
            const p = getPlayer(reg.playerId)
            if (!p) return null

            return (
              <ListRow key={reg.id}>
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
                <TransferControl
                  pending={pendingByFromPlayerId.get(String(reg.playerId))}
                  getPlayer={getPlayer}
                  respondingTo={respondingTo}
                  onOpenShareModal={onOpenShareModal}
                  onAdminCancelTransfer={onAdminCancelTransfer}
                  onStartTransfer={() => onStartTransfer(reg)}
                />
              </ListRow>
            )
          })}
        </ListCard>
      )}

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
    </Section>
  )
}

function TransferControl({
  pending,
  getPlayer,
  respondingTo,
  onOpenShareModal,
  onAdminCancelTransfer,
  onStartTransfer,
}: Pick<
  RegisteredSectionProps,
  'getPlayer' | 'respondingTo' | 'onOpenShareModal' | 'onAdminCancelTransfer'
> & {
  pending: NormalisedTransfer | undefined
  onStartTransfer: () => void
}) {
  if (pending) {
    const recipient = getPlayer(pending.toPlayerId)
    const recipientFirst = (recipient?.name || '').split(/\s+/)[0] || 'them'
    return (
      <AlertBox
        variant="warning"
        size="sm"
        icon={<Clock />}
        actions={
          recipient && (
            <OutgoingTransferActions
              onResend={() => onOpenShareModal({ transferId: pending.id, toPlayer: recipient })}
              onCancel={() => onAdminCancelTransfer(pending.id)}
              busy={respondingTo === pending.id}
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
      onClick={onStartTransfer}
    >
      Transfer spot to another player
    </Button>
  )
}
