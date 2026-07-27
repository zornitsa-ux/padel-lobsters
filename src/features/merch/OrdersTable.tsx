import React, { useState } from 'react'
import { Ban } from 'lucide-react'
import type { Player } from '../../lib/normalise'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { STATUS_CONFIG } from './statusConfig'
import { errorMessage, formatOrderTime, getPlayerName, orderTimestamp } from './formatters'
import { useMerchActions } from './useMerch'
import type { MerchInterest, MerchItem } from './merchSchemas'

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
          <button
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
            className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {cancelOrder.isPending ? 'Cancelling…' : 'Cancel Order'}
          </button>
        }
      >
        {cancelTarget && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
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
          <div className="flex gap-2 text-[11px] text-gray-500 px-1">
            <span>{activeOrders.length} orders</span>
            <span>·</span>
            <span className="text-amber-600">
              {activeOrders.filter((o) => o.status === 'ordered').length} pending
            </span>
            <span>·</span>
            <span className="text-green-600">
              {activeOrders.filter((o) => o.status === 'paid').length} paid
            </span>
            <span>·</span>
            <span className="text-blue-600">
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
                      <p className="font-semibold text-gray-800">
                        {playerName?.split(' ')[0] || `Player #${o.player_id}`}
                        <span className="font-normal text-gray-500 ml-1.5 text-xs">
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
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                            "{o.custom_name}"
                          </span>
                        )}
                        <span className="text-xs font-bold text-lob-teal">€{orderPrice}</span>
                        <span className="text-[11px] text-gray-400">
                          {formatOrderTime(o.created_at)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                    >
                      <StatusIcon size={10} /> {cfg.label}
                    </span>
                  </div>
                  {/* Status action buttons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => markOrder.mutate({ id: o.id, status: 'paid' }, { onError })}
                      disabled={status === 'paid' || status === 'delivered' || markOrder.isPending}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        status === 'paid' || status === 'delivered'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500 active:scale-95'
                      }`}
                    >
                      {status === 'paid' || status === 'delivered' ? '✓ Paid' : 'Mark Paid'}
                    </button>
                    <button
                      onClick={() =>
                        markOrder.mutate({ id: o.id, status: 'delivered' }, { onError })
                      }
                      disabled={status === 'delivered' || markOrder.isPending}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        status === 'delivered'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-500 active:scale-95'
                      }`}
                    >
                      {status === 'delivered' ? '✓ Delivered' : 'Mark Delivered'}
                    </button>
                    <button
                      onClick={() => setCancelTarget(o)}
                      className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-400 active:scale-95 transition-all"
                    >
                      <Ban size={12} />
                    </button>
                  </div>
                </div>
              )
            })}

          {/* Cancelled orders (collapsed) */}
          {cancelledOrders.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer font-medium px-1">
                {cancelledOrders.length} cancelled order{cancelledOrders.length > 1 ? 's' : ''}
              </summary>
              <div className="space-y-2 mt-2">
                {cancelledOrders.map((o) => {
                  const playerName = getPlayerName({ order: o, players })
                  const item = items.find((i) => i.id === o.merch_item_id)
                  return (
                    <div key={o.id} className="card opacity-60 space-y-1">
                      <p className="text-sm text-gray-500 line-through">
                        {playerName?.split(' ')[0] || 'Unknown'} — {item?.name}{' '}
                        {o.size && `(${o.size})`}
                      </p>
                      {o.admin_comment && (
                        <p className="text-xs text-red-400 italic">"{o.admin_comment}"</p>
                      )}
                      <p className="text-[10px] text-gray-400">
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
