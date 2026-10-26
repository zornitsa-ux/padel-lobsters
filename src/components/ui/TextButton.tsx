import React from 'react'
import { renderAction, type ActionProps } from './action'

type Tone = 'accent' | 'primary' | 'destructive' | 'warning' | 'neutral'
/** `inherit` takes the surrounding text size, for links inside a sentence. */
type Size = 'xs' | 'sm' | 'inherit'

interface TextButtonContentProps {
  children: React.ReactNode
  tone?: Tone
  size?: Size
  /** Leading icon; sizing stays with the caller. */
  icon?: React.ReactNode
  /** Layout only (margins, `block`). */
  className?: string
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
  inherit: '',
}

const textButtonClasses = ({
  tone = 'accent',
  size = 'xs',
  icon,
  className,
}: Omit<TextButtonContentProps, 'children'>) =>
  [
    icon ? 'inline-flex items-center gap-1' : '',
    'font-semibold underline underline-offset-2',
    TONE[tone],
    'disabled:text-lob-muted-light disabled:cursor-not-allowed',
    SIZE[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

export function TextButton({ children, tone, size, icon, className, ...props }: TextButtonProps) {
  return renderAction({
    props,
    className: textButtonClasses({ tone, size, icon, className }),
    children: (
      <>
        {icon}
        {children}
      </>
    ),
  })
}
