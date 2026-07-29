import React from 'react'
import Avatar from './Avatar'
import type { AvatarPlayer, AvatarSize } from './Avatar'

interface PlayerRowProps {
  /** Renders an <Avatar> in the leading slot. Ignored when `avatar` is given. */
  player?: AvatarPlayer
  avatarSize?: AvatarSize
  /** Class-based avatar tone — see Avatar's `tone`. */
  avatarTone?: string
  /** Custom leading visual, for rows whose marker is not a player avatar. */
  avatar?: React.ReactNode
  /** Rank or position marker rendered before the avatar. */
  prefix?: React.ReactNode
  name: React.ReactNode
  /** Replaces the default name styling wholesale. */
  nameClassName?: string
  subtitle?: React.ReactNode
  /** Extra content under the name — badge rows and other non-caption detail. */
  children?: React.ReactNode
  /** Trailing slot: badge, IconButton, score, action group. */
  trailing?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

const NAME_CLASS = 'font-semibold text-sm text-lob-dark truncate'

export function PlayerRow({
  player,
  avatarSize = 'md',
  avatarTone,
  avatar,
  prefix,
  name,
  nameClassName,
  subtitle,
  children,
  trailing,
  onClick,
  disabled,
  className,
}: PlayerRowProps) {
  const leading =
    avatar ?? (player ? <Avatar player={player} size={avatarSize} tone={avatarTone} /> : null)

  const content = (
    <>
      {prefix}
      {leading}
      <div className="flex-1 min-w-0">
        <p className={nameClassName ?? NAME_CLASS}>{name}</p>
        {subtitle && <p className="text-xs text-lob-muted">{subtitle}</p>}
        {children}
      </div>
      {trailing}
    </>
  )

  const classes = `flex items-center gap-3 ${className ?? ''}`.trim()

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${classes} text-left`}
      >
        {content}
      </button>
    )
  }

  return <div className={classes}>{content}</div>
}
