import React from 'react'
import { Chip, ChipGroup, secondaryText } from './Chip'

export type SegmentedValue = string | number | boolean

export interface SegmentedOption<T extends SegmentedValue> {
  value: T
  label: React.ReactNode
  /** Second line under the label (`fill` only), e.g. "3 teams · suggested". */
  detail?: React.ReactNode
  /** Shown after the label (`wrap` and `scroll` only), e.g. a filter's row count. */
  count?: number
  disabled?: boolean
}

/**
 * `fill` is an equal-width row of segments, for two to four choices. `wrap` and `scroll`
 * render `Chip`s, for longer sets such as rounds, filters or sizes.
 */
type Layout = 'fill' | 'wrap' | 'scroll'

interface SegmentedControlProps<T extends SegmentedValue> {
  options: SegmentedOption<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  layout?: Layout
  /** Accessible name for the group. */
  ariaLabel?: string
  disabled?: boolean
  /** Nothing picked yet where a pick is required; marks the unselected options. */
  invalid?: boolean
}

const SEGMENT =
  'flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all not-disabled:active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'

const segmentClasses = ({ selected, invalid }: { selected: boolean; invalid: boolean }) => {
  if (selected) return `${SEGMENT} bg-lob-teal text-white`
  return `${SEGMENT} bg-lob-teal-light text-lob-muted${invalid ? ' ring-1 ring-lob-danger-border' : ''}`
}

export function SegmentedControl<T extends SegmentedValue>({
  options,
  value,
  onChange,
  layout = 'fill',
  ariaLabel,
  disabled = false,
  invalid = false,
}: SegmentedControlProps<T>) {
  if (layout !== 'fill') {
    return (
      <ChipGroup layout={layout} ariaLabel={ariaLabel} invalid={invalid}>
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            selected={option.value === value}
            count={option.count}
            invalid={invalid}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
    )
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className="flex gap-2"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={segmentClasses({ selected, invalid })}
          >
            {option.label}
            {option.detail && (
              <span className={`block text-xs font-normal ${secondaryText({ selected })}`}>
                {option.detail}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
