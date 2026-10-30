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
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { TextButton } from '../../components/ui/TextButton'

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
        <div className="space-y-4">
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

            <ListCard>
              {[...activeOrders]
                .sort((a, b) => orderTimestamp(b.created_at) - orderTimestamp(a.created_at))
                .map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    item={items.find((i) => i.id === o.merch_item_id)}
                    playerName={getPlayerName({ order: o, players })}
                    markOrder={markOrder}
                    onCancel={() => setCancelTarget(o)}
                  />
                ))}
            </ListCard>
          </div>

          <CancelledOrders orders={cancelledOrders} items={items} players={players} />
        </div>
      ) : (
        <EmptyState title="No orders yet — orders will appear here when players place them from the Shop tab" />
      )}
    </div>
  )
}

function OrderRow({
  order: o,
  item,
  playerName,
  markOrder,
  onCancel,
}: {
  order: MerchInterest
  item: MerchItem | undefined
  playerName: string | null
  markOrder: ReturnType<typeof useMerchActions>['markOrder']
  onCancel: () => void
}) {
  // A failed status write used to be swallowed, leaving the button looking like
  // it had worked until the next refetch.
  const onError = (err: unknown) => alert('Could not update the order: ' + errorMessage(err))
  const status = o.status
  const cfg = STATUS_CONFIG[status]
  const StatusIcon = cfg.icon
  const hasCustomName = o.customName.length > 0
  const isShirt = item ? /shirt/i.test(item.name) : false
  const orderPrice = (item ? item.price : 0) + (isShirt && hasCustomName ? 5 : 0)
  return (
    <ListRow>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lob-dark">
            {playerName?.split(' ')[0] || `Player #${o.player_id}`}
            <span className="font-normal text-lob-muted ml-1.5 text-xs">{item?.name || '—'}</span>
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
            <span className="text-xs text-lob-muted-light">{formatOrderTime(o.created_at)}</span>
          </div>
        </div>
        <Badge tone={cfg.tone} label={cfg.label} icon={<StatusIcon />} />
      </div>
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
            onClick={() => markOrder.mutate({ id: o.id, status: 'delivered' }, { onError })}
            disabled={markOrder.isPending}
          >
            Mark Delivered
          </Button>
        )}
        <IconButton onClick={onCancel} aria-label="Cancel order" variant="destructive" size="sm">
          <Ban />
        </IconButton>
      </div>
    </ListRow>
  )
}

function CancelledOrders({
  orders,
  items,
  players,
}: {
  orders: MerchInterest[]
  items: MerchItem[]
  players: Player[]
}) {
  const [expanded, setExpanded] = useState(false)
  if (orders.length === 0) return null
  return (
    <Section
      icon={<Ban />}
      title={`Cancelled (${orders.length})`}
      action={
        <TextButton hitArea aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide' : 'Show'}
        </TextButton>
      }
    >
      {expanded && (
        <ListCard>
          {orders.map((o) => {
            const item = items.find((i) => i.id === o.merch_item_id)
            return (
              <ListRow key={o.id}>
                <div className="opacity-60 space-y-1">
                  <p className="text-sm text-lob-muted line-through">
                    {getPlayerName({ order: o, players })?.split(' ')[0] || 'Unknown'} —{' '}
                    {item?.name} {o.size && `(${o.size})`}
                  </p>
                  {o.admin_comment && (
                    <p className="text-xs text-lob-danger italic">"{o.admin_comment}"</p>
                  )}
                  <p className="text-2xs text-lob-muted-light">
                    {formatOrderTime(o.cancelled_at || o.created_at)}
                  </p>
                </div>
              </ListRow>
            )
          })}
        </ListCard>
      )}
    </Section>
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
