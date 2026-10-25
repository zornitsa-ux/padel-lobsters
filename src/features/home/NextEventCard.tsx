import React, { type ReactNode } from 'react'
import { Calendar, CalendarDays, CreditCard } from 'lucide-react'
import DateTile from '../../components/ui/DateTile'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import { fmtEur } from '../../lib/format'
import type { NormalisedTournament } from '../../lib/normalise'
import { perPersonCost } from './homeHelpers'
import { Button } from '../../components/ui/Button'

interface NextEventCardProps {
  upcoming: NormalisedTournament | undefined
  isAdmin: boolean
  claimedId: string | null
  isRegistered: boolean
  /** No tournaments read yet — "no upcoming events" would be a guess, not a fact. */
  loading?: boolean
  /** Registrations still in flight, so this player's sign-up state is unknown. */
  registrationsPending?: boolean
  onNavigate: (page: string, tournament?: NormalisedTournament) => void
  formatDate: (date: string | null | undefined) => string
  /** King of the Court: the viewer's starting court or placing. */
  kingOfCourtLine?: ReactNode
}

// Placeholder that mirrors the loaded card's metrics — eyebrow, title, the
// md DateTile's 3.5rem × 4rem box, two meta lines, action row — so the real
// event lands in place instead of shoving the page around.
function NextEventSkeleton() {
  return (
    <div className="card-elevated" role="status" aria-busy="true">
      <span className="sr-only">Loading your next event…</span>
      <Skeleton className="h-3 w-24 mb-1" />
      <Skeleton className="h-6 w-3/5" />
      <div className="mt-2 mb-3 flex items-center gap-3">
        <Skeleton className="w-14 h-16 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// ── Next event — glass card ───────────────────────────── */
export default function NextEventCard({
  upcoming,
  isAdmin,
  claimedId,
  isRegistered,
  loading = false,
  registrationsPending = false,
  onNavigate,
  formatDate,
  kingOfCourtLine = null,
}: NextEventCardProps) {
  if (loading) return <NextEventSkeleton />

  if (!upcoming) {
    return (
      <EmptyState
        icon={<Calendar size={36} />}
        title="No upcoming events right now"
        description="Check back soon — next tournament is around the corner."
        action={
          isAdmin && (
            <Button onClick={() => onNavigate('tournament')} size="md" className="mt-2">
              Create an Event
            </Button>
          )
        }
      />
    )
  }

  const ppCost = perPersonCost(upcoming)

  return (
    <div className="card-elevated">
      <p className="text-2xs font-bold text-lob-coral uppercase tracking-wide mb-1">
        Your Next Event
      </p>
      <h2 className="text-lg font-bold text-lob-dark">
        <button
          onClick={() => onNavigate('registration', upcoming)}
          className="hover:text-lob-teal active:scale-95 transition-all text-left"
        >
          {upcoming.name}
        </button>
      </h2>
      {/* Match the Event page header exactly: DateTile + bold date label
          + time/duration on a second line + add-to-calendar icon. */}
      <div className="mt-2 mb-3 flex items-center gap-3">
        <DateTile date={upcoming.date} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-lob-dark leading-tight">
            {formatDate(upcoming.date)}
          </p>
          {upcoming.time && (
            <p className="text-sm text-lob-muted leading-tight mt-0.5">
              {upcoming.time}
              {upcoming.duration ? ` · ${upcoming.duration}min` : ''}
            </p>
          )}
          {ppCost > 0 && (
            <p className="text-sm font-semibold text-lob-teal leading-tight mt-0.5">
              {fmtEur(ppCost)}/pp
            </p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <ShareWhatsAppButton tournament={upcoming} variant="icon" />
          <AddToCalendarButton tournament={upcoming} variant="icon" />
        </div>
      </div>

      {/* Registration status badge. Held back until registrations land —
          `isRegistered` defaults to false, so rendering early tells a
          signed-up player they haven't signed up. */}
      {claimedId && registrationsPending && <Skeleton className="h-7 w-40 rounded-lg mb-3" />}
      {claimedId &&
        !registrationsPending &&
        (isRegistered ? (
          <div className="bg-lob-success-light border border-lob-success-border rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 mb-3">
            <span className="text-lob-success-solid text-xs">✓</span>
            <span className="text-xs font-semibold text-lob-success">You're registered!</span>
          </div>
        ) : !isAdmin ? (
          <button
            onClick={() => onNavigate('registration', upcoming)}
            className="bg-lob-warning-light border border-lob-warning-border rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 mb-3 active:scale-95 transition-all"
          >
            <span className="text-lob-warning-solid text-xs">!</span>
            <span className="text-xs font-semibold text-lob-warning">
              Not signed up yet — tap to join
            </span>
          </button>
        ) : null)}
      {isRegistered && kingOfCourtLine}

      {/* Event description — preserves line breaks from the admin form. */}
      {upcoming.notes && upcoming.notes.trim() && (
        <p className="text-xs text-lob-slate leading-relaxed whitespace-pre-line mb-3">
          {upcoming.notes}
        </p>
      )}

      {/* Action links */}
      <div className="flex gap-2">
        <button
          onClick={() => onNavigate('registration', upcoming)}
          className="flex-1 bg-lob-coral text-white font-semibold py-2 rounded-xl text-xs active:scale-95 transition-all"
        >
          Registrations
        </button>
        <button
          onClick={() => onNavigate('schedule', upcoming)}
          className="flex-none bg-gray-100 text-lob-slate font-semibold py-1.5 px-3 rounded-lg text-xs active:scale-95 transition-all flex items-center gap-1"
        >
          <CalendarDays size={12} /> Schedule
        </button>
        {isAdmin && (
          <button
            onClick={() => onNavigate('payments', upcoming)}
            className="flex-none bg-gray-100 text-lob-slate font-semibold py-1.5 px-3 rounded-lg text-xs active:scale-95 transition-all flex items-center gap-1"
          >
            <CreditCard size={12} /> Payments
          </button>
        )}
      </div>
    </div>
  )
}
