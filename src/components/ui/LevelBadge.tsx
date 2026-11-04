/** Playtomic level bands (owner, 2026-11-04): a teal ramp, darker as the level rises. */
const LEVEL_BANDS = [
  { below: 2, className: 'bg-lob-line-strong text-lob-slate' },
  { below: 4, className: 'bg-lob-teal-light text-lob-teal-dark' },
  { below: 5, className: 'ring-1 ring-inset ring-lob-teal text-lob-teal-dark' },
  { below: Infinity, className: 'bg-lob-teal text-white' },
] as const

const SIZES = {
  md: 'text-sm px-2.5 py-1 rounded-lg',
  sm: 'text-xs px-1.5 py-0.5 rounded',
} as const

const levelBand = ({ level }: { level: number | null | undefined }): string => {
  const value = level ?? 0
  return (LEVEL_BANDS.find((band) => value < band.below) ?? LEVEL_BANDS[0]).className
}

interface LevelBadgeProps {
  /** Playtomic level, 0 to 7; a missing level shows 0.0 in the lowest band. */
  level: number | null | undefined
  /** md beside a name in a list or header; sm inline in a line of text. */
  size?: keyof typeof SIZES
}

/** A player's Playtomic level, one decimal, in its band's colour. */
export function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  return (
    <span className={`inline-block font-bold tabular-nums ${SIZES[size]} ${levelBand({ level })}`}>
      {(level || 0).toFixed(1)}
    </span>
  )
}
