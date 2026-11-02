export type RankKind = 'position' | 'waitlist' | 'medal'

interface RankMarkerProps {
  rank: number
  /** position: "#3". waitlist: "W3". medal: 🥇🥈🥉 for the top three, then "#4". */
  kind?: RankKind
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const markerText = ({ rank, kind }: Required<RankMarkerProps>): string => {
  if (kind === 'waitlist') return `W${rank}`
  if (kind === 'medal' && MEDALS[rank]) return MEDALS[rank]
  return `#${rank}`
}

/** A rank or place before a row's name: one fixed width, so the names line up. Goes in `PlayerRow`'s `prefix`. */
export function RankMarker({ rank, kind = 'position' }: RankMarkerProps) {
  const tone = kind === 'waitlist' ? 'text-lob-warning-solid' : 'text-lob-muted'
  return (
    <span className={`w-6 shrink-0 text-center text-xs font-bold tabular-nums ${tone}`}>
      {markerText({ rank, kind })}
    </span>
  )
}
