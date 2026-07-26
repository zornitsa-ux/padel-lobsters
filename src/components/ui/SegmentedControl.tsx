import React from 'react'

export type SegmentedValue = string | number

export interface SegmentedOption<T extends SegmentedValue> {
  value: T
  label: React.ReactNode
}

/** `fill` = equal-width row, `scroll` = horizontally scrollable strip, `wrap` = auto-width chips. */
type Layout = 'fill' | 'scroll' | 'wrap'
/** `sm` chip, `md` strip button, `lg` form control. */
type Size = 'sm' | 'md' | 'lg'
type Shape = 'rounded' | 'pill'

interface SegmentedControlProps<T extends SegmentedValue> {
  options: SegmentedOption<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  layout?: Layout
  size?: Size
  shape?: Shape
  /** Accessible name for the group. */
  ariaLabel?: string
  className?: string
}

const LAYOUT: Record<Layout, { container: string; item: string }> = {
  fill: { container: 'flex gap-2', item: 'flex-1' },
  scroll: { container: 'flex gap-1.5 overflow-x-auto', item: 'flex-shrink-0' },
  wrap: { container: 'flex gap-1.5 flex-wrap', item: '' },
}

const SIZE: Record<Size, string> = {
  sm: 'text-[11px] px-2.5 py-1',
  md: 'text-xs px-3 py-1.5',
  lg: 'text-sm px-3 py-2.5',
}

const SHAPE: Record<Shape, string> = {
  rounded: 'rounded-xl',
  pill: 'rounded-full',
}

export function SegmentedControl<T extends SegmentedValue>({
  options,
  value,
  onChange,
  layout = 'fill',
  size = 'lg',
  shape = 'rounded',
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const { container, item } = LAYOUT[layout]
  return (
    <div role="group" aria-label={ariaLabel} className={`${container} ${className ?? ''}`.trim()}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`${item} ${SIZE[size]} ${SHAPE[shape]} font-semibold transition-all active:scale-95 ${
              selected ? 'bg-lob-teal text-white' : 'bg-lob-teal-light text-lob-muted'
            }`.trim()}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
