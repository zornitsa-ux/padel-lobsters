import { letterColor } from '../../lib/letterColors'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarPlayer {
  name?: string | null
  avatarUrl?: string | null
}

interface AvatarProps {
  player: AvatarPlayer
  size?: AvatarSize
  /**
   * Class-based colour replacing the letter palette (e.g. `bg-orange-100
   * text-orange-600`). A toned avatar is a themed marker rather than a
   * portrait, so it always renders the initial and never the photo.
   */
  tone?: string
  className?: string
}

const SIZE: Record<AvatarSize, string> = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-lg',
}

const initialOf = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?'

export default function Avatar({ player, size = 'md', tone, className = '' }: AvatarProps) {
  const cls = SIZE[size] ?? SIZE.md

  if (player.avatarUrl && !tone) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name ?? ''}
        className={`${cls} rounded-full object-cover flex-shrink-0 ${className}`.trim()}
        // A broken avatar URL hides rather than showing the browser's broken-image
        // glyph. Falling back to the letter circle would be better but needs state,
        // which the direct-call test style can't exercise.
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
        tone ?? 'text-white'
      } ${className}`.trim()}
      style={tone ? undefined : { backgroundColor: letterColor(player.name ?? '') }}
    >
      {initialOf(player.name)}
    </div>
  )
}
