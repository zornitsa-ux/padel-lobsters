import React from 'react'
import { renderAction, type ActionProps } from './action'

interface ChipContentProps {
  children: React.ReactNode
  /** Toggle state. Set it (true or false) for a toggle or a selection; omit for a plain filter link. */
  selected?: boolean
  /** Shown after the label, e.g. how many rows the filter matches. */
  count?: number
}

type ChipProps = ChipContentProps & ActionProps

const BASE =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors not-disabled:active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'

const STATE = {
  selected: 'bg-lob-teal border-lob-teal text-white',
  default: 'bg-white border-lob-line-strong text-lob-slate not-disabled:hover:border-lob-teal',
}

/**
 * A toggle, filter or selection pill (32px, the height of `Button sm`). A row of them goes in
 * `ChipGroup`; picking one value from a set is `SegmentedControl layout="wrap"`.
 */
export function Chip({ children, selected, count, ...props }: ChipProps) {
  const pressed =
    selected === undefined || props.to || props.href ? {} : { 'aria-pressed': selected }
  return renderAction({
    props: { ...pressed, ...props } as ActionProps,
    className: `${BASE} ${selected ? STATE.selected : STATE.default}`,
    children: (
      <>
        {children}
        {count !== undefined && (
          <span className={selected ? 'text-white/80' : 'text-lob-muted'}>{count}</span>
        )}
      </>
    ),
  })
}

type ChipLayout = 'wrap' | 'scroll'

const LAYOUT: Record<ChipLayout, string> = {
  wrap: 'flex flex-wrap gap-1.5',
  scroll: 'flex gap-1.5 overflow-x-auto hide-scrollbar',
}

interface ChipGroupProps {
  children: React.ReactNode
  /** `wrap` flows onto new lines; `scroll` is one horizontally scrolling line. */
  layout?: ChipLayout
  /** Accessible name for the group. */
  ariaLabel?: string
}

export function ChipGroup({ children, layout = 'wrap', ariaLabel }: ChipGroupProps) {
  return (
    <div role="group" aria-label={ariaLabel} className={LAYOUT[layout]}>
      {children}
    </div>
  )
}
