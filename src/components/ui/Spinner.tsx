interface SpinnerProps {
  /** Wrapper utilities — mainly vertical padding for the block it fills. */
  className?: string
  label?: string
}

export function Spinner({ className = 'py-16', label = 'Loading…' }: SpinnerProps) {
  return (
    <div
      className={`flex items-center justify-center ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 border-2 border-lob-teal border-t-transparent rounded-full animate-spin" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
