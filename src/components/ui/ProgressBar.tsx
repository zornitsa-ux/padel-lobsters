export interface ProgressBarProps {
  /** Percentage 0–100. Non-finite values (e.g. divide-by-zero) render as empty. */
  value: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  fillClassName?: string
  trackClassName?: string
  className?: string
}

const sizeClasses: Record<NonNullable<ProgressBarProps['size']>, string> = {
  xs: 'h-1.5',
  sm: 'h-2',
  md: 'h-2.5',
  lg: 'h-3',
}

const clamp = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0)

export function ProgressBar({
  value,
  size = 'sm',
  fillClassName = 'bg-lob-teal',
  trackClassName = 'bg-gray-100',
  className = '',
}: ProgressBarProps) {
  return (
    <div
      className={`${sizeClasses[size]} ${trackClassName} rounded-full overflow-hidden ${className}`.trim()}
    >
      <div
        className={`h-full rounded-full transition-all ${fillClassName}`}
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  )
}
