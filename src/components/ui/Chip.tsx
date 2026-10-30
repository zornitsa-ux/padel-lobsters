import React from 'react'
import { renderAction, type ActionProps } from './action'

interface ChipContentProps {
  children: React.ReactNode
  /** Toggle state. Set it (true or false) for a toggle or a selection; omit for a plain filter link. */
  selected?: boolean
  /** Shown after the label, e.g. how many rows the filter matches. */
  count?: number
  /** Danger border while unselected, e.g. a required size nobody picked yet. */
  invalid?: boolean
}

type ChipProps = ChipContentProps & ActionProps

const BASE =
  'inline-flex items-center gap-1.5 min-h-8 max-w-full px-3 py-1 rounded-full border text-xs font-semibold text-left transition-colors not-disabled:active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'

const stateClasses = ({ selected, invalid }: { selected?: boolean; invalid?: boolean }) => {
  if (selected) return 'bg-lob-teal border-lob-teal text-white'
  const border = invalid ? 'border-lob-danger-border' : 'border-lob-line-strong'
  return `bg-white ${border} text-lob-slate not-disabled:hover:border-lob-teal`
}

/** Muted text beside a label (a chip's count, a segment's detail line). */
export const secondaryText = ({ selected }: { selected: boolean }) =>
  selected ? 'text-white/80' : 'text-lob-muted'

/**
 * A toggle, filter or selection pill (32px, the height of `Button sm`). A row of them goes in
 * `ChipGroup`; picking one value from a set is `SegmentedControl layout="wrap"`.
 */
export function Chip({ children, selected, count, invalid, ...props }: ChipProps) {
  const pressed =
    selected === undefined || props.to || props.href ? {} : { 'aria-pressed': selected }
  return renderAction({
    props: { ...pressed, ...props } as ActionProps,
    className: `${BASE} ${stateClasses({ selected, invalid })}`,
    children: (
      <>
        {children}
        {count !== undefined && (
          <span className={secondaryText({ selected: !!selected })}>{count}</span>
        )}
      </>
    ),
  })
}

type ChipLayout = 'wrap' | 'scroll'

const LAYOUT: Record<ChipLayout, string> = {
  wrap: 'flex flex-wrap gap-1.5',
  scroll: 'flex gap-1.5 overflow-x-auto hide-scrollbar [&>*]:whitespace-nowrap',
}

interface ChipGroupProps {
  children: React.ReactNode
  /** `wrap` flows onto new lines; `scroll` is one horizontally scrolling line. */
  layout?: ChipLayout
  /** Accessible name for the group. */
  ariaLabel?: string
  /** A required pick is missing (`aria-invalid`); mark the chips with `Chip invalid`. */
  invalid?: boolean
  /** Id of the `FormError` shown while `invalid`. */
  describedBy?: string
}

export function ChipGroup({
  children,
  layout = 'wrap',
  ariaLabel,
  invalid,
  describedBy,
}: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? describedBy : undefined}
      className={LAYOUT[layout]}
    >
      {children}
    </div>
  )
}
