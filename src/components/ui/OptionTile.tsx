import React from 'react'
import { renderAction, type ActionProps } from './action'

type OptionTileProps = {
  children: React.ReactNode
  /** Set (true or false) when picking one tile from a grid; sets `aria-pressed`. */
  selected?: boolean
  /** Grey well background for a tile that is done, e.g. a category already voted in. */
  muted?: boolean
} & ActionProps

const BASE = 'flex flex-col gap-1 min-w-0 rounded-xl border p-3 text-left transition-colors'

const surface = ({ muted }: { muted?: boolean }) =>
  muted ? 'bg-lob-well border-lob-line-strong' : 'bg-white border-lob-line-strong'

const stateClasses = ({ selected, muted }: { selected?: boolean; muted?: boolean }) =>
  selected
    ? 'bg-lob-teal-light border-lob-teal'
    : `${surface({ muted })} not-disabled:hover:border-lob-teal`

const isAction = (props: ActionProps) =>
  (props as { onClick?: unknown }).onClick !== undefined ||
  props.to !== undefined ||
  props.href !== undefined

/**
 * A grid tile: an Oscars category or a player to vote for. The content marks the pick (a
 * check, "Voted: …"); the tile tints teal when `selected`. With no `onClick`, `to` or `href`
 * it is a read-only tile.
 */
export function OptionTile({ children, selected, muted, ...props }: OptionTileProps) {
  if (!isAction(props)) {
    return <div className={`${BASE} ${surface({ muted })}`}>{children}</div>
  }
  const pressed =
    selected === undefined || props.to || props.href ? {} : { 'aria-pressed': selected }
  return renderAction({
    props: { ...pressed, ...props } as ActionProps,
    className: `${BASE} ${stateClasses({ selected, muted })} not-disabled:active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`,
    children,
  })
}

interface ImageTileProps {
  src: string
  selected: boolean
  onClick: () => void
  /** Names the image, e.g. "Photo 2 of 3". */
  'aria-label': string
}

/** A 48px image thumbnail for switching between photos; the current one has a teal border. */
export function ImageTile({ src, selected, onClick, 'aria-label': ariaLabel }: ImageTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={selected || undefined}
      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-opacity ${
        selected ? 'border-lob-teal' : 'border-transparent opacity-60 hover:opacity-100'
      }`}
    >
      <img src={src} alt="" className="w-full h-full object-cover" />
    </button>
  )
}
