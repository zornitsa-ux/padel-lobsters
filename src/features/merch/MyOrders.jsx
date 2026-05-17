import React from 'react'
import { ShoppingBag, Ban, Package } from 'lucide-react'
import { STATUS_CONFIG } from './statusConfig'
import { formatOrderTime } from './formatters'

// ── My Orders tab (player-facing) ───────────────────────────────────────────
export default function MyOrders({ myOrders, items }) {
  return (
    <div className="space-y-3">
      {myOrders.length > 0 ? (
        myOrders
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map((o) => {
            const item = items.find((i) => i.id === o.merch_item_id)
            const status = o.status || 'ordered'
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered
            const StatusIcon = cfg.icon
            return (
              <div
                key={o.id}
                className={`card space-y-2 ${status === 'cancelled' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    {item?.image_url ? (
                      <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={18} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{item?.name || 'Item'}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {o.size && (
                        <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">
                          {o.size}
                        </span>
                      )}
                      {(o.custom_name || '').trim() && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                          Name: {o.custom_name}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {formatOrderTime(o.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Status timeline */}
                <div className="flex items-center gap-1 pt-1">
                  {['ordered', 'paid', 'delivered'].map((s, i) => {
                    const sCfg = STATUS_CONFIG[s]
                    const SIcon = sCfg.icon
                    const steps = ['ordered', 'paid', 'delivered']
                    const currentIdx = status === 'cancelled' ? -1 : steps.indexOf(status)
                    const active = steps.indexOf(s) <= currentIdx
                    return (
                      <React.Fragment key={s}>
                        {i > 0 && (
                          <div
                            className={`flex-1 h-0.5 rounded ${active ? 'bg-lobster-teal' : 'bg-gray-200'}`}
                          />
                        )}
                        <div
                          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                            active ? `${sCfg.bg} ${sCfg.text}` : 'bg-gray-100 text-gray-300'
                          }`}
                        >
                          <SIcon size={10} /> {sCfg.label}
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
                {/* Cancelled notice */}
                {status === 'cancelled' && (
                  <div className="bg-red-50 rounded-xl p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                      <Ban size={11} /> Order cancelled by admin
                    </p>
                    {o.admin_comment && (
                      <p className="text-xs text-red-400 italic">"{o.admin_comment}"</p>
                    )}
                  </div>
                )}
              </div>
            )
          })
      ) : (
        <div className="card py-8 text-center text-gray-400">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No orders yet — browse the Shop to get started</p>
        </div>
      )}
    </div>
  )
}
