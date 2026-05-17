import React from 'react'
import { AlertCircle, ShoppingBag } from 'lucide-react'

// ── Admin alerts ──────────────────────────────────────── */
// Bundles the three admin-only home-page alerts:
//   • unpaid players for the next event
//   • upcoming birthdays in the next 7 days
//   • new merch orders since last admin check
// Each renders only when there's something to show.
export default function AdminAlerts({
  isAdmin,
  unpaid,
  upcomingEvent,
  players,
  newOrders,
  onDismissMerch,
  formatUpdateTime,
  onNavigate,
}) {
  if (!isAdmin) return null

  // Birthday calc — same shape as the inline IIFE on the original Dashboard.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming7 = players
    .filter((p) => p.birthday)
    .map((p) => {
      const d = new Date(p.birthday)
      let bday = new Date(today.getFullYear(), d.getMonth(), d.getDate())
      if (bday < today) bday = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
      const diff = Math.round((bday - today) / 86400000)
      return { p, diff }
    })
    .filter(({ diff }) => diff <= 7)
    .sort((a, b) => a.diff - b.diff)

  return (
    <>
      {unpaid.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {unpaid.length} player{unpaid.length > 1 ? 's' : ''} haven't paid yet
          </p>
          <button
            onClick={() => onNavigate('payments', upcomingEvent)}
            className="ml-auto text-xs text-red-600 font-semibold"
          >
            View
          </button>
        </div>
      )}

      {/* ── Birthday alerts (admin) ───────────────────────────── */}
      {upcoming7.length > 0 && (
        <div className="card border-l-4 border-pink-300 bg-pink-50/40 space-y-2">
          <p className="font-bold text-sm text-pink-700">🎂 Upcoming Birthdays</p>
          {upcoming7.map(({ p, diff }) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-base">{diff === 0 ? '🎉' : '🎂'}</span>
              <span className="text-sm font-semibold text-gray-700">{p.name.split(' ')[0]}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {diff === 0 ? 'Today! 🎈' : diff === 1 ? 'Tomorrow' : `In ${diff} days`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── New merch orders (admin) ─────────────────────────── */}
      {newOrders.length > 0 && (
        <div className="card border-l-4 border-lobster-teal space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-gray-700 flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-lobster-teal" /> New Merch Orders
              <span className="bg-lobster-teal text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {newOrders.length}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDismissMerch()
                  onNavigate('merch-orders')
                }}
                className="text-xs text-lobster-teal font-semibold"
              >
                View all
              </button>
              <button onClick={onDismissMerch} className="text-xs text-gray-400 font-medium">
                Dismiss
              </button>
            </div>
          </div>
          {newOrders.slice(0, 5).map((o) => {
            const playerName = o.playerName?.split(' ')[0] || 'Someone'
            const itemName = o.itemName || 'item'
            const ago = formatUpdateTime(o.created_at)
            return (
              <div key={o.id} className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-lobster-cream flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={12} className="text-lobster-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 truncate">
                    <span className="font-semibold">{playerName}</span> ordered{' '}
                    <span className="font-medium">{itemName}</span>
                    {o.size && <span className="text-gray-400"> · {o.size}</span>}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{ago}</span>
              </div>
            )
          })}
          {newOrders.length > 5 && (
            <p className="text-xs text-gray-400 text-center">+{newOrders.length - 5} more</p>
          )}
        </div>
      )}
    </>
  )
}
