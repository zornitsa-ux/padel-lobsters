import { Clock, Sparkles } from 'lucide-react'

interface WaitlistStatusCardProps {
  waitlistPosition?: number
  /** The event has a free spot — nobody is promoted automatically any more. */
  spotOpen: boolean
  registering: boolean
  /** Set when the grab failed; blank otherwise. */
  error?: string
  onGrab: () => void
}

/**
 * A waitlisted player's status, shared by the Info tab and /me. When a spot is
 * open the player takes it themselves: register_for_tournament moves their
 * waitlist row to registered under the tournament lock, so if several tap at
 * once only one gets it and the rest stay waitlisted.
 */
export default function WaitlistStatusCard({
  waitlistPosition,
  spotOpen,
  registering,
  error,
  onGrab,
}: WaitlistStatusCardProps) {
  if (spotOpen) {
    return (
      <div className="card bg-green-50 border border-green-200 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-green-700 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">A spot just opened up</p>
        </div>
        <p className="text-xs text-green-700">First to grab it gets it.</p>
        <button
          onClick={onGrab}
          disabled={registering}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {registering ? 'Grabbing…' : 'Grab the spot'}
        </button>
        {error && (
          <p role="alert" className="text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="card bg-amber-50 border border-amber-200 space-y-1">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          You&apos;re on the waitlist
          {waitlistPosition ? ` · #${waitlistPosition}` : ''}
        </p>
      </div>
      <p className="text-xs text-amber-700 pl-5">
        We&apos;ll email you if a spot opens up — first to grab it gets it.
      </p>
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-600 pl-5">
          {error}
        </p>
      )}
    </div>
  )
}
