import React from 'react'
import { ShoppingBag, Ban, Package } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { STATUS_CONFIG } from './statusConfig'
import { formatOrderTime, orderTimestamp } from './formatters'
import type { MerchInterest, MerchItem, OrderStatus } from './merchSchemas'
import { AlertBox } from '../../components/ui/AlertBox'
import { Badge } from '../../components/ui/Badge'

const STEPS: readonly OrderStatus[] = ['ordered', 'paid', 'delivered']

type MyOrdersProps = {
  myOrders: MerchInterest[]
  items: MerchItem[]
}

// ── My Orders tab (player-facing) ───────────────────────────────────────────
export default function MyOrders({ myOrders, items }: MyOrdersProps) {
  return (
    <div className="space-y-3">
      {myOrders.length > 0 ? (
        [...myOrders]
          .sort((a, b) => orderTimestamp(b.created_at) - orderTimestamp(a.created_at))
          .map((o) => {
            const item = items.find((i) => i.id === o.merch_item_id)
            const status = o.status
            return (
              <div
                key={o.id}
                className={`card space-y-2 ${status === 'cancelled' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    {item?.images[0] ? (
                      <img src={item.images[0]} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={18} className="text-lob-muted-light" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lob-dark">{item?.name || 'Item'}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {o.size && (
                        <span className="text-xs font-bold bg-lob-cream text-lob-teal px-2 py-0.5 rounded-full">
                          {o.size}
                        </span>
                      )}
                      {o.customName && (
                        <span className="text-xs bg-lob-warning-light text-lob-warning px-2 py-0.5 rounded-full font-medium">
                          Name: {o.customName}
                        </span>
                      )}
                      <span className="text-xs text-lob-muted-light">
                        {formatOrderTime(o.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Status timeline */}
                <div className="flex items-center gap-1 pt-1">
                  {STEPS.map((s, i) => {
                    const sCfg = STATUS_CONFIG[s]
                    const SIcon = sCfg.icon
                    const currentIdx = status === 'cancelled' ? -1 : STEPS.indexOf(status)
                    const active = STEPS.indexOf(s) <= currentIdx
                    return (
                      <React.Fragment key={s}>
                        {i > 0 && (
                          <div
                            className={`flex-1 h-0.5 rounded ${active ? 'bg-lob-teal' : 'bg-lob-line-strong'}`}
                          />
                        )}
                        <Badge
                          tone={active ? sCfg.tone : 'neutral'}
                          label={sCfg.label}
                          icon={<SIcon />}
                        />
                      </React.Fragment>
                    )
                  })}
                </div>
                {/* Cancelled notice */}
                {status === 'cancelled' && (
                  <AlertBox
                    variant="error"
                    size="sm"
                    icon={<Ban />}
                    title="Order cancelled by admin"
                  >
                    {o.admin_comment && <span className="italic">"{o.admin_comment}"</span>}
                  </AlertBox>
                )}
              </div>
            )
          })
      ) : (
        <EmptyState
          icon={<Package size={32} />}
          title="No orders yet — browse the Shop to get started"
        />
      )}
    </div>
  )
}
