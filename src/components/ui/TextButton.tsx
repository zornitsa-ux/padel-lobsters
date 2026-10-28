import React from 'react'
import { renderAction, type ActionProps } from './action'

type Tone = 'accent' | 'primary' | 'destructive' | 'warning' | 'neutral'
/** `inherit` takes the surrounding text size, for links inside a sentence. `lg` is a headline name. */
type Size = 'xs' | 'sm' | 'lg' | 'inherit'

interface TextButtonContentProps {
  children: React.ReactNode
  tone?: Tone
  size?: Size
  /** Leading icon; sizing stays with the caller. */
  icon?: React.ReactNode
  /** One line, cut with an ellipsis; shrinks in a flex row (names in tight rows). */
  truncate?: boolean
  /** A tap target at least 40px tall that doesn't move the layout, for a lone small action. */
  hitArea?: boolean
}

type TextButtonProps = TextButtonContentProps & ActionProps

const TONE: Record<Tone, string> = {
  accent: 'text-lob-teal',
  primary: 'text-lob-coral',
  destructive: 'text-lob-danger',
  warning: 'text-lob-warning',
  neutral: 'text-lob-muted hover:text-lob-slate',
}

const SIZE: Record<Size, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  lg: 'text-lg',
  inherit: '',
}

// Padding grows the target; the matching negative margin keeps the layout where it was.
const HIT_AREA = 'px-2 -mx-2 py-3 -my-3'

const textButtonClasses = ({
  tone = 'accent',
  size = 'xs',
  icon,
  truncate,
  hitArea,
}: Omit<TextButtonContentProps, 'children'>) =>
  [
    icon ? 'inline-flex items-center gap-1' : '',
    'font-semibold underline underline-offset-2',
    TONE[tone],
    'disabled:text-lob-muted-light disabled:cursor-not-allowed',
    SIZE[size],
    truncate ? 'min-w-0 max-w-full truncate text-left' : '',
    hitArea ? HIT_AREA : '',
  ]
    .filter(Boolean)
    .join(' ')

export function TextButton({
  children,
  tone,
  size,
  icon,
  truncate,
  hitArea,
  ...props
}: TextButtonProps) {
  return renderAction({
    props,
    className: textButtonClasses({ tone, size, icon, truncate, hitArea }),
    children: (
      <>
        {icon}
        {children}
      </>
    ),
  })
}
