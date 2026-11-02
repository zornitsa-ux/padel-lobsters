export type RankKind = 'position' | 'waitlist' | 'medal'

interface RankMarkerProps {
  /** 1-based. Anything else (a missing rank) keeps the width and shows nothing. */
  rank: number
  /** position: "#3". waitlist: "W3". medal: 🥇🥈🥉 for the top three, then "#4". */
  kind?: RankKind
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** 🥇🥈🥉 for ranks 1 to 3, otherwise undefined. */
export const medalFor = ({ rank }: { rank: number }): string | undefined => MEDALS[rank]

const markerText = ({ rank, kind }: Required<RankMarkerProps>): string => {
  if (!Number.isInteger(rank) || rank < 1) return ''
  if (kind === 'waitlist') return `W${rank}`
  if (kind === 'medal' && MEDALS[rank]) return MEDALS[rank]
  return `#${rank}`
}

/**
 * A rank or place before a row's name: one fixed width, so the names line up, in a flex row or a
 * table cell. Goes in `PlayerRow`'s `prefix`.
 */
export function RankMarker({ rank, kind = 'position' }: RankMarkerProps) {
  const tone = kind === 'waitlist' ? 'text-lob-warning-solid' : 'text-lob-muted'
  const text = markerText({ rank, kind })
  const size = kind === 'medal' && medalFor({ rank }) ? 'text-sm' : 'text-xs'
  return (
    <span
      className={`inline-block w-7 shrink-0 text-center font-bold tabular-nums ${size} ${tone}`}
    >
      {text}
    </span>
  )
}
