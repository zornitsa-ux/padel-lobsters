import React, { useState } from 'react'
import { X, Ban } from 'lucide-react'
import { supabase } from '../../supabase'
import { STATUS_CONFIG } from './statusConfig'
import { formatOrderTime, getPlayerName } from './formatters'

// ── Orders tab (admin-facing) ────────────────────────────────────────────────
export default function OrdersTable({ activeOrders, interests, items, players, loadInterests }) {
  // Cancel order modal state
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelComment, setCancelComment] = useState('')

  return (
    <div className="space-y-4">
      {/* Cancel order modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Cancel Order</h3>
              <button
                onClick={() => {
                  setCancelTarget(null)
                  setCancelComment('')
                }}
              >
                <X size={22} className="text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Cancel order for{' '}
              <strong>{getPlayerName(cancelTarget, players)?.split(' ')[0] || 'player'}</strong> —{' '}
              {items.find((i) => i.id === cancelTarget.merch_item_id)?.name}?
            </p>
            <textarea
              placeholder="Add a comment for the player (optional)…"
              value={cancelComment}
              onChange={(e) => setCancelComment(e.target.value)}
              className="input text-sm w-full h-20 resize-none"
            />
            <button
              onClick={async () => {
                const { error } = await supabase
                  .from('merch_interests')
                  .update({
                    status: 'cancelled',
                    admin_comment: cancelComment || null,
                    cancelled_at: new Date().toISOString(),
                    paid: false,
                    delivered: false,
                  })
                  .eq('id', cancelTarget.id)
                if (error) {
                  // Fallback: try without status fields (pre-v12)
                  await supabase
                    .from('merch_interests')
                    .update({
                      paid: false,
                      delivered: false,
                    })
                    .eq('id', cancelTarget.id)
                }
                setCancelTarget(null)
                setCancelComment('')
                await loadInterests()
              }}
              className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all"
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}

      {activeOrders.length > 0 ? (
        <div className="space-y-2">
          {/* Summary stats */}
          <div className="flex gap-2 text-[11px] text-gray-500 px-1">
            <span>{activeOrders.length} orders</span>
            <span>·</span>
            <span className="text-amber-600">
              {activeOrders.filter((o) => (o.status || 'ordered') === 'ordered').length} pending
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
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((o) => {
              const playerName = getPlayerName(o, players)
              const item = items.find((i) => i.id === o.merch_item_id)
              const status = o.status || 'ordered'
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered
              const StatusIcon = cfg.icon
              const basePrice = item ? parseFloat(item.price) : 0
              const hasCustomName = (o.custom_name || '').trim().length > 0
              const isShirt = item && /shirt/i.test(item.name)
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
                          <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">
                            {o.size}
                          </span>
                        )}
                        {hasCustomName && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                            "{o.custom_name}"
                          </span>
                        )}
                        <span className="text-xs font-bold text-lobster-teal">€{orderPrice}</span>
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
                      onClick={async () => {
                        await supabase
                          .from('merch_interests')
                          .update({ status: 'paid', paid: true })
                          .eq('id', o.id)
                        await loadInterests()
                      }}
                      disabled={status === 'paid' || status === 'delivered'}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        status === 'paid' || status === 'delivered'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500 active:scale-95'
                      }`}
                    >
                      {status === 'paid' || status === 'delivered' ? '✓ Paid' : 'Mark Paid'}
                    </button>
                    <button
                      onClick={async () => {
                        await supabase
                          .from('merch_interests')
                          .update({ status: 'delivered', delivered: true })
                          .eq('id', o.id)
                        await loadInterests()
                      }}
                      disabled={status === 'delivered'}
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
          {interests.filter((o) => o.status === 'cancelled' && getPlayerName(o, players)).length >
            0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer font-medium px-1">
                {
                  interests.filter((o) => o.status === 'cancelled' && getPlayerName(o, players))
                    .length
                }{' '}
                cancelled order
                {interests.filter((o) => o.status === 'cancelled' && getPlayerName(o, players))
                  .length > 1
                  ? 's'
                  : ''}
              </summary>
              <div className="space-y-2 mt-2">
                {interests
                  .filter((o) => o.status === 'cancelled' && getPlayerName(o, players))
                  .map((o) => {
                    const playerName = getPlayerName(o, players)
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
        <div className="card py-6 text-center text-gray-400 text-sm">
          No orders yet — orders will appear here when players place them from the Shop tab
        </div>
      )}
    </div>
  )
}
