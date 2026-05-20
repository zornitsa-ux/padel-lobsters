import React from 'react'
import { Calendar, CalendarDays, CreditCard } from 'lucide-react'
import DateTile from '../../components/ui/DateTile'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import { fmtEur } from '../../lib/format'

// ── Next event — glass card ───────────────────────────── */
export default function NextEventCard({
  upcoming,
  isAdmin,
  claimedId,
  isRegistered,
  onNavigate,
  formatDate,
}) {
  if (!upcoming) {
    return (
      <div className="card flex flex-col items-center py-8 text-center gap-2">
        <Calendar size={36} className="text-gray-300" />
        <p className="text-sm text-gray-500">No upcoming events right now</p>
        <p className="text-xs text-gray-400">
          Check back soon — next tournament is around the corner.
        </p>
        {isAdmin && (
          <button
            onClick={() => onNavigate('tournament')}
            className="btn-primary text-sm py-2 px-4 mt-2"
          >
            Create an Event
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-4 shadow-sm bg-white/80 border border-white/90"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <p className="text-[10px] font-bold text-lobster-orange uppercase tracking-wide mb-1">
        Your Next Event
      </p>
      <h2 className="text-lg font-bold text-gray-800">
        <button
          onClick={() => onNavigate('registration', upcoming)}
          className="hover:text-lobster-teal active:scale-95 transition-all text-left"
        >
          {upcoming.name}
        </button>
      </h2>
      {/* Match the Event page header exactly: DateTile + bold date label
          + time/duration on a second line + add-to-calendar icon. */}
      <div className="mt-2 mb-3 flex items-center gap-3">
        <DateTile date={upcoming.date} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-800 leading-tight">
            {formatDate(upcoming.date)}
          </p>
          {upcoming.time && (
            <p className="text-sm text-gray-500 leading-tight mt-0.5">
              {upcoming.time}
              {upcoming.duration ? ` · ${upcoming.duration}min` : ''}
            </p>
          )}
          {(() => {
            const tp = parseFloat(upcoming.totalPrice) || 0
            const mp = parseInt(upcoming.maxPlayers) || 16
            const ppCost =
              !upcoming.courtBookingMode || upcoming.courtBookingMode === 'admin_all'
                ? tp > 0
                  ? tp / mp
                  : 0
                : (upcoming.courts || []).reduce(
                    (s, c) => s + (parseFloat(c.costPerPerson) || 0),
                    0,
                  )
            return ppCost > 0 ? (
              <p className="text-sm font-semibold text-lobster-teal leading-tight mt-0.5">
                {fmtEur(ppCost)}/pp
              </p>
            ) : null
          })()}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <ShareWhatsAppButton tournament={upcoming} variant="icon" />
          <AddToCalendarButton tournament={upcoming} variant="icon" />
        </div>
      </div>

      {/* Registration status badge */}
      {claimedId &&
        (isRegistered ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 mb-3">
            <span className="text-green-600 text-xs">✓</span>
            <span className="text-xs font-semibold text-green-700">You're registered!</span>
          </div>
        ) : !isAdmin ? (
          <button
            onClick={() => onNavigate('registration', upcoming)}
            className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 mb-3 active:scale-95 transition-all"
          >
            <span className="text-orange-500 text-xs">!</span>
            <span className="text-xs font-semibold text-orange-700">
              Not signed up yet — tap to join
            </span>
          </button>
        ) : null)}

      {/* Event description — preserves line breaks from the admin form. */}
      {upcoming.notes && upcoming.notes.trim() && (
        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line mb-3">
          {upcoming.notes}
        </p>
      )}

      {/* Action links */}
      <div className="flex gap-2">
        <button
          onClick={() => onNavigate('registration', upcoming)}
          className="flex-1 bg-lobster-orange text-white font-semibold py-2 rounded-xl text-xs active:scale-95 transition-all"
        >
          Registrations
        </button>
        <button
          onClick={() => onNavigate('schedule', upcoming)}
          className="flex-none bg-gray-100 text-gray-600 font-semibold py-1.5 px-3 rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1"
        >
          <CalendarDays size={12} /> Schedule
        </button>
        {isAdmin && (
          <button
            onClick={() => onNavigate('payments', upcoming)}
            className="flex-none bg-gray-100 text-gray-600 font-semibold py-1.5 px-3 rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1"
          >
            <CreditCard size={12} /> Payments
          </button>
        )}
      </div>
    </div>
  )
}
