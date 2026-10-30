import React, { useState } from 'react'
import { Ban, Check } from 'lucide-react'
import type { Player } from '../../lib/normalise'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { STATUS_CONFIG } from './statusConfig'
import { errorMessage, formatOrderTime, getPlayerName, orderTimestamp } from './formatters'
import { useMerchActions } from './useMerch'
import type { MerchInterest, MerchItem } from './merchSchemas'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

type OrdersTableProps = {
  activeOrders: MerchInterest[]
  interests: MerchInterest[]
  items: MerchItem[]
  players: Player[]
}

// ── Orders tab (admin-facing) ────────────────────────────────────────────────
export default function OrdersTable({ activeOrders, interests, items, players }: OrdersTableProps) {
  const { markOrder, cancelOrder } = useMerchActions()
  // Cancel order modal state
  const [cancelTarget, setCancelTarget] = useState<MerchInterest | null>(null)
  const [cancelComment, setCancelComment] = useState('')

  // A failed status write used to be swallowed, leaving the button looking like
  // it had worked until the next refetch.
  const onError = (err: unknown) => alert('Could not update the order: ' + errorMessage(err))

  const cancelledOrders = interests.filter(
    (o) => o.status === 'cancelled' && getPlayerName({ order: o, players }),
  )

  const closeCancelModal = () => {
    setCancelTarget(null)
    setCancelComment('')
  }

  return (
    <div className="space-y-4">
      {/* Cancel order modal */}
      <Modal
        open={!!cancelTarget}
        onClose={closeCancelModal}
        title="Cancel Order"
        footer={
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              if (!cancelTarget) return
              try {
                await cancelOrder.mutateAsync({ id: cancelTarget.id, comment: cancelComment })
              } catch (err) {
                alert('Could not cancel the order: ' + errorMessage(err))
                return
              }
              closeCancelModal()
            }}
            disabled={cancelOrder.isPending}
          >
            {cancelOrder.isPending ? 'Cancelling…' : 'Cancel Order'}
          </Button>
        }
      >
        {cancelTarget && (
          <div className="space-y-3">
            <p className="text-sm text-lob-muted">
              Cancel order for{' '}
              <strong>
                {getPlayerName({ order: cancelTarget, players })?.split(' ')[0] || 'player'}
              </strong>{' '}
              — {items.find((i) => i.id === cancelTarget.merch_item_id)?.name}?
            </p>
            <textarea
              placeholder="Add a comment for the player (optional)…"
              value={cancelComment}
              onChange={(e) => setCancelComment(e.target.value)}
              className="input text-sm w-full h-20 resize-none"
            />
          </div>
        )}
      </Modal>

      {activeOrders.length > 0 ? (
        <div className="space-y-2">
          {/* Summary stats */}
          <div className="flex gap-2 text-xs text-lob-muted px-1">
            <span>{activeOrders.length} orders</span>
            <span>·</span>
            <span className="text-lob-warning">
              {activeOrders.filter((o) => o.status === 'ordered').length} pending
            </span>
            <span>·</span>
            <span className="text-lob-success">
              {activeOrders.filter((o) => o.status === 'paid').length} paid
            </span>
            <span>·</span>
            <span className="text-lob-success">
              {activeOrders.filter((o) => o.status === 'delivered').length} delivered
            </span>
          </div>

          {/* Order cards */}
          {[...activeOrders]
            .sort((a, b) => orderTimestamp(b.created_at) - orderTimestamp(a.created_at))
            .map((o) => {
              const playerName = getPlayerName({ order: o, players })
              const item = items.find((i) => i.id === o.merch_item_id)
              const status = o.status
              const cfg = STATUS_CONFIG[status]
              const StatusIcon = cfg.icon
              const basePrice = item ? item.price : 0
              const hasCustomName = o.customName.length > 0
              const isShirt = item ? /shirt/i.test(item.name) : false
              const orderPrice = basePrice + (isShirt && hasCustomName ? 5 : 0)
              return (
                <div key={o.id} className="card space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lob-dark">
                        {playerName?.split(' ')[0] || `Player #${o.player_id}`}
                        <span className="font-normal text-lob-muted ml-1.5 text-xs">
                          {item?.name || '—'}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {o.size && (
                          <span className="text-xs font-bold bg-lob-cream text-lob-teal px-2 py-0.5 rounded-full">
                            {o.size}
                          </span>
                        )}
                        {hasCustomName && (
                          <span className="text-xs bg-lob-warning-light text-lob-warning px-2 py-0.5 rounded-full font-medium">
                            "{o.custom_name}"
                          </span>
                        )}
                        <span className="text-xs font-bold text-lob-teal">€{orderPrice}</span>
                        <span className="text-xs text-lob-muted-light">
                          {formatOrderTime(o.created_at)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={cfg.tone} label={cfg.label} icon={<StatusIcon />} />
                  </div>
                  {/* Status action buttons */}
                  <div className="flex gap-1.5">
                    {status === 'paid' || status === 'delivered' ? (
                      <StepDone>Paid</StepDone>
                    ) : (
                      <Button
                        variant="neutral"
                        size="sm"
                        grow
                        onClick={() => markOrder.mutate({ id: o.id, status: 'paid' }, { onError })}
                        disabled={markOrder.isPending}
                      >
                        Mark Paid
                      </Button>
                    )}
                    {status === 'delivered' ? (
                      <StepDone>Delivered</StepDone>
                    ) : (
                      <Button
                        variant="neutral"
                        size="sm"
                        grow
                        onClick={() =>
                          markOrder.mutate({ id: o.id, status: 'delivered' }, { onError })
                        }
                        disabled={markOrder.isPending}
                      >
                        Mark Delivered
                      </Button>
                    )}
                    <IconButton
                      onClick={() => setCancelTarget(o)}
                      aria-label="Cancel order"
                      variant="destructive"
                      size="sm"
                    >
                      <Ban />
                    </IconButton>
                  </div>
                </div>
              )
            })}

          {/* Cancelled orders (collapsed) */}
          {cancelledOrders.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-lob-muted-light cursor-pointer font-medium px-1">
                {cancelledOrders.length} cancelled order{cancelledOrders.length > 1 ? 's' : ''}
              </summary>
              <div className="space-y-2 mt-2">
                {cancelledOrders.map((o) => {
                  const playerName = getPlayerName({ order: o, players })
                  const item = items.find((i) => i.id === o.merch_item_id)
                  return (
                    <div key={o.id} className="card opacity-60 space-y-1">
                      <p className="text-sm text-lob-muted line-through">
                        {playerName?.split(' ')[0] || 'Unknown'} — {item?.name}{' '}
                        {o.size && `(${o.size})`}
                      </p>
                      {o.admin_comment && (
                        <p className="text-xs text-lob-danger italic">"{o.admin_comment}"</p>
                      )}
                      <p className="text-2xs text-lob-muted-light">
                        {formatOrderTime(o.cancelled_at || o.created_at)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </div>
      ) : (
        <EmptyState title="No orders yet — orders will appear here when players place them from the Shop tab" />
      )}
    </div>
  )
}

// A finished order step, in place of its button; the same 32px height keeps the row steady.
function StepDone({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex-1 min-h-8 flex items-center justify-center gap-1 text-xs font-semibold text-lob-success">
      <Check size={14} /> {children}
    </p>
  )
}
