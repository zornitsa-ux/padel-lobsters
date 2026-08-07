import React from 'react'
import { AlertCircle } from 'lucide-react'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedRegistration } from '../events/registrationQueries'
import { upcomingBirthdays, type BirthdayPlayer } from './homeHelpers'

interface AdminAlertsProps {
  isAdmin: boolean
  unpaid: NormalisedRegistration[]
  upcomingEvent: NormalisedTournament | undefined
  players: BirthdayPlayer[]
  onNavigate: (page: string, tournament?: NormalisedTournament) => void
}

// ── Admin alerts ──────────────────────────────────────── */
// Bundles the two admin-only home-page alerts:
//   • unpaid players for the next event
//   • upcoming birthdays in the next 7 days
// Each renders only when there's something to show. Merch orders used to be a
// third card here; they live in Admin Tools now.
export default function AdminAlerts({
  isAdmin,
  unpaid,
  upcomingEvent,
  players,
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
    </>
  )
}
