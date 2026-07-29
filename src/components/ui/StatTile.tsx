export interface StatTileProps {
  value: React.ReactNode
  label: string
  /** sm: text-lg value (in-card tiles). md: text-2xl value (summary bars). */
  size?: 'sm' | 'md'
  /** muted: light background. inverted: coloured background. caps: uppercase key/value. */
  labelVariant?: 'muted' | 'inverted' | 'caps'
  /** Per-tile value colour, e.g. 'text-green-600'. */
  valueClassName?: string
  className?: string
}

const valueSizeClasses: Record<NonNullable<StatTileProps['size']>, string> = {
  sm: 'text-lg font-bold',
  md: 'text-2xl font-bold',
}

const labelClasses: Record<NonNullable<StatTileProps['labelVariant']>, string> = {
  muted: 'text-[9px] text-lob-muted-light font-medium',
  inverted: 'text-xs opacity-75',
  caps: 'text-[10px] font-bold text-lob-muted-light uppercase tracking-wider',
}

export function StatTile({
  value,
  label,
  size = 'sm',
  labelVariant = 'muted',
  valueClassName = '',
  className = '',
}: StatTileProps) {
  return (
    <div className={`text-center ${className}`.trim()}>
      <p className={`${valueSizeClasses[size]} ${valueClassName}`.trim()}>{value}</p>
      <p className={labelClasses[labelVariant]}>{label}</p>
    </div>
  )
}
