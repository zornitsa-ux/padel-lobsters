type SpinnerSize = 'page' | 'inline'

interface SpinnerProps {
  /** `page`: a page or route body. `inline`: the body of a loading card, under its title. */
  size?: SpinnerSize
  label?: string
}

const sizes: Record<SpinnerSize, { wrapper: string; ring: string }> = {
  page: { wrapper: 'py-16', ring: 'h-8 w-8' },
  inline: { wrapper: 'py-4', ring: 'h-5 w-5' },
}

export function Spinner({ size = 'page', label = 'Loading…' }: SpinnerProps) {
  const s = sizes[size]
  return (
    <div
      className={`flex items-center justify-center ${s.wrapper}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${s.ring} border-2 border-lob-teal border-t-transparent rounded-full animate-spin`}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
