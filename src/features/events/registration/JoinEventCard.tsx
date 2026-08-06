import { CheckCircle, Clock, UserRoundX } from 'lucide-react'
import type { MyRegistrationSummary } from '../nextMatch'

interface JoinEventCardProps {
  /** Derived by `myRegistrationSummary` — the same source /me reads. */
  summary: MyRegistrationSummary
  isEventFull: boolean
  /** Whether this event can take a payment at all (Tikkie configured). */
  hasTikkie: boolean
  registering: boolean
  /** Set when the sign-up failed; blank otherwise. */
  error?: string
  onRegister: () => void
  /** Sends the player to /me, which owns the payment flow. */
  onGoToPayment: () => void
}

/**
 * Sign-up on the Info tab: the player's own way in, right where they are
 * reading about the event. Deliberately narrow — it registers, joins the
 * waitlist, and reports which of those happened. Payment lives on /me, so an
 * outstanding balance links there rather than duplicating the Tikkie flow.
 */
export default function JoinEventCard({
  summary,
  isEventFull,
  hasTikkie,
  registering,
  error,
  onRegister,
  onGoToPayment,
}: JoinEventCardProps) {
  if (summary.status === 'not_registered' || summary.status === 'cancelled') {
    const wasCancelled = summary.status === 'cancelled'
    return (
      <div className="card space-y-3">
        <p className="text-sm text-lob-muted flex items-center gap-2">
          {wasCancelled ? (
            <>
              <UserRoundX size={14} className="text-lob-muted flex-shrink-0" />
              Your registration was cancelled.
            </>
          ) : isEventFull ? (
            'This event is full — join the waitlist and you’ll get the next spot that opens.'
          ) : (
            "You haven't signed up yet."
          )}
        </p>
        <button
          onClick={onRegister}
          disabled={registering}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {registering
            ? 'Signing up…'
            : isEventFull
              ? 'Join the waitlist'
              : wasCancelled
                ? 'Register again'
                : 'Register for this event'}
        </button>
        {error && (
          <p role="alert" className="text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (summary.status === 'waitlisted') {
    return (
      <div className="card bg-amber-50 border border-amber-200 space-y-1">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            You&apos;re on the waitlist
            {summary.waitlistPosition ? ` · #${summary.waitlistPosition}` : ''}
          </p>
        </div>
        <p className="text-xs text-amber-700 pl-5">You&apos;ll be notified if a spot opens up.</p>
      </div>
    )
  }

  const ps = summary.paymentStatus
  const isConfirmed = ps === 'paid' || ps === 'transferred'
  const needsPayment = (!ps || ps === 'unpaid') && hasTikkie

  return (
    <div className="card flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-lob-dark">You&apos;re registered</span>
      </div>
      {isConfirmed ? (
        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
          ✓ Confirmed
        </span>
      ) : needsPayment ? (
        <button
          onClick={onGoToPayment}
          className="text-xs font-semibold text-lob-coral underline underline-offset-2 flex-shrink-0"
        >
          Pay on the You tab
        </button>
      ) : null}
    </div>
  )
}
