import { Link } from 'react-router-dom'

export interface DeviceTrustBannerProps {
  onDismiss: () => void
}

export default function DeviceTrustBanner({ onDismiss }: DeviceTrustBannerProps) {
  return (
    <div className="w-full bg-lob-coral-light border border-lob-coral/40 text-lob-dark px-4 py-3 flex flex-col gap-2 rounded-b-2xl shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-lob-dark">
            This device is read-only until approved.
          </p>
          <p className="text-xs text-lob-muted leading-snug">
            Admins or an already-trusted device must approve this one before you can mutate data.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-lob-coral text-sm font-semibold tracking-wide underline-offset-4 underline"
          aria-label="Dismiss trust notice"
        >
          Dismiss
        </button>
      </div>
      <div className="text-xs">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 rounded-full border border-lob-coral px-3 py-1 text-lob-coral font-semibold text-[11px] tracking-wide"
        >
          Request approval in Settings
        </Link>
      </div>
    </div>
  )
}
