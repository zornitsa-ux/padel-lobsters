import { CheckCircle, UserRoundX } from 'lucide-react'
import type { MyRegistrationSummary } from '../nextMatch'
import { Button } from '../../../components/ui/Button'
import { TextButton } from '../../../components/ui/TextButton'
import WaitlistNotice from './WaitlistNotice'
import { AlertBox } from '../../../components/ui/AlertBox'
import { isSettled } from '../paymentStatus'
import PaymentStatusBadge from './PaymentStatusBadge'

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
        <Button onClick={onRegister} disabled={registering} fullWidth>
          {registering
            ? 'Signing up…'
            : isEventFull
              ? 'Join the waitlist'
              : wasCancelled
                ? 'Register again'
                : 'Register for this event'}
        </Button>
        {error && (
          <AlertBox variant="error" size="sm">
            {error}
          </AlertBox>
        )}
      </div>
    )
  }

  if (summary.status === 'waitlisted') {
    return <WaitlistNotice position={summary.waitlistPosition} />
  }

  const ps = summary.paymentStatus
  const isConfirmed = isSettled(ps)
  const needsPayment = (!ps || ps === 'unpaid') && hasTikkie

  return (
    <div className="card flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle size={14} className="text-lob-success-solid flex-shrink-0" />
        <span className="text-sm font-semibold text-lob-dark">You&apos;re registered</span>
      </div>
      {isConfirmed ? (
        <PaymentStatusBadge paymentStatus={ps} />
      ) : needsPayment ? (
        <TextButton tone="primary" onClick={onGoToPayment}>
          Pay on the You tab
        </TextButton>
      ) : null}
    </div>
  )
}
