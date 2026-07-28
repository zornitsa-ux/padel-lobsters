import React from 'react'
import { AlertCircle, ShoppingBag } from 'lucide-react'
import type { NormalisedTournament } from '../../lib/normalise'
import type { MerchInterest } from '../merch/merchSchemas'
import type { NormalisedRegistration } from '../events/registrationQueries'
import { upcomingBirthdays, type BirthdayPlayer } from './homeHelpers'

// A merch order joined with the two display names the alert renders. Built by
// Dashboard from the merch slice's cached rows.
export type NewMerchOrder = MerchInterest & {
  playerName: string | null
  itemName: string
}

interface AdminAlertsProps {
  isAdmin: boolean
  unpaid: NormalisedRegistration[]
  upcomingEvent: NormalisedTournament | undefined
  players: BirthdayPlayer[]
  newOrders: NewMerchOrder[]
  onDismissMerch: () => void
  formatUpdateTime: (ts: string | null | undefined) => string
  onNavigate: (page: string, tournament?: NormalisedTournament) => void
}

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
}: AdminAlertsProps) {
  if (!isAdmin) return null

  const upcoming7 = upcomingBirthdays({ players, today: new Date() })

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
              <span className="text-sm font-semibold text-lob-slate">{p.name.split(' ')[0]}</span>
              <span className="text-xs text-lob-muted ml-auto">
                {diff === 0 ? 'Today! 🎈' : diff === 1 ? 'Tomorrow' : `In ${diff} days`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── New merch orders (admin) ─────────────────────────── */}
      {newOrders.length > 0 && (
        <div className="card border-l-4 border-lob-teal space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-lob-slate flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-lob-teal" /> New Merch Orders
              <span className="bg-lob-teal text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {newOrders.length}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDismissMerch()
                  onNavigate('merch-orders')
                }}
                className="text-xs text-lob-teal font-semibold"
              >
                View all
              </button>
              <button onClick={onDismissMerch} className="text-xs text-lob-muted-light font-medium">
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
                <div className="w-7 h-7 rounded-full bg-lob-cream flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={12} className="text-lob-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lob-slate truncate">
                    <span className="font-semibold">{playerName}</span> ordered{' '}
                    <span className="font-medium">{itemName}</span>
                    {o.size && <span className="text-lob-muted-light"> · {o.size}</span>}
                  </p>
                </div>
                <span className="text-xs text-lob-muted-light flex-shrink-0">{ago}</span>
              </div>
            )
          })}
          {newOrders.length > 5 && (
            <p className="text-xs text-lob-muted-light text-center">+{newOrders.length - 5} more</p>
          )}
        </div>
      )}
    </>
  )
}
