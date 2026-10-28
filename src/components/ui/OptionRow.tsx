import React from 'react'
import { Check } from 'lucide-react'
import { renderAction, type ActionProps } from './action'

interface OptionRowContentProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Avatar or icon before the title; decorative, so hidden from screen readers. */
  leading?: React.ReactNode
  /** Detail after the title, inside the tap target: a level, a chevron. */
  trailing?: React.ReactNode
  /** Controls beside the row, outside its tap target, e.g. a reveal or retry IconButton. */
  actions?: React.ReactNode
  /** Set (true or false) in a pick-one list; omit for a row that acts straight away. */
  selected?: boolean
}

// `title` is the row's heading here, not the HTML tooltip attribute.
type ActionPropsWithoutTitle = ActionProps extends infer A
  ? A extends unknown
    ? Omit<A, 'title'>
    : never
  : never

type OptionRowProps = OptionRowContentProps & ActionPropsWithoutTitle

const shellClasses = ({ selected, disabled }: { selected?: boolean; disabled?: boolean }) => {
  const state = selected
    ? 'bg-lob-teal-light border-lob-teal'
    : `bg-lob-well border-lob-line ${disabled ? '' : 'hover:border-lob-teal'}`
  return `flex items-center rounded-xl border transition-colors ${state} ${disabled ? 'opacity-50' : ''}`.trim()
}

const TARGET =
  'flex-1 min-w-0 flex items-center gap-3 p-2.5 rounded-xl text-left disabled:cursor-not-allowed'

/**
 * A tappable row in a list: pick a player, pick a candidate, jump to a task. `selected` tints
 * it teal with a check and sets `aria-pressed`. Rows stack in a `space-y-1` parent.
 */
export function OptionRow({
  title,
  subtitle,
  leading,
  trailing,
  actions,
  selected,
  ...props
}: OptionRowProps) {
  const pressed =
    selected === undefined || props.to || props.href ? {} : { 'aria-pressed': selected }
  return (
    <div className={shellClasses({ selected, disabled: props.disabled })}>
      {renderAction({
        props: { ...pressed, ...props } as ActionProps,
        className: TARGET,
        children: (
          <>
            {leading && (
              <span className="flex-shrink-0" aria-hidden="true">
                {leading}
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-lob-dark truncate">{title}</span>
              {subtitle && <span className="block text-xs text-lob-muted">{subtitle}</span>}
            </span>
            {trailing && (
              <span className="flex items-center flex-shrink-0 text-xs font-semibold text-lob-muted">
                {trailing}
              </span>
            )}
            {selected && (
              <Check size={16} className="text-lob-teal flex-shrink-0" aria-hidden="true" />
            )}
          </>
        ),
      })}
      {actions && (
        <div className="flex items-center gap-1 flex-shrink-0 max-w-[40%] pr-2.5 text-xs text-lob-muted">
          {actions}
        </div>
      )}
    </div>
  )
}
