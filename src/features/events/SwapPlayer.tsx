import Avatar from '../../components/ui/Avatar'

interface SwapPlayerProps {
  name: string
  /** The short name shown beside the avatar. */
  label: string
  isLeftHanded?: boolean
  /** Which side of the court the row sits on: the avatar faces the score. */
  side: 'left' | 'right'
  swapping: boolean
  selected: boolean
  onTap: () => void
}

/** Inverted, so it can't be mistaken for a teal letter colour. */
const SELECTED_TONE = 'bg-white text-lob-teal ring-2 ring-lob-teal'

/** A player in a saved schedule's court; tapping two of them in swap mode swaps them. */
export function SwapPlayer({
  name,
  label,
  isLeftHanded,
  side,
  swapping,
  selected,
  onTap,
}: SwapPlayerProps) {
  const state = selected
    ? 'bg-lob-teal-light ring-2 ring-lob-teal'
    : swapping
      ? 'hover:bg-lob-line'
      : ''
  return (
    <div
      onClick={onTap}
      className={`flex items-center gap-1.5 mb-1 rounded-lg px-1 transition-all ${side === 'right' ? 'flex-row-reverse' : ''} ${swapping ? 'cursor-pointer active:scale-95' : ''} ${state}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar player={{ name }} size="xs" tone={selected ? SELECTED_TONE : undefined} />
        {isLeftHanded && (
          <span
            className={`absolute -top-1 ${side === 'right' ? '-left-1' : '-right-1'} text-3xs bg-lob-warning-solid text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold`}
          >
            L
          </span>
        )}
      </div>
      <span className="text-sm font-medium truncate">{label}</span>
    </div>
  )
}
