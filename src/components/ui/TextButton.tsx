import React from 'react'
import { Link } from 'react-router-dom'

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

type TextButtonProps = TextButtonContentProps &
  (
    | { to: string; href?: never; onClick?: never; disabled?: never; type?: never }
    | { href: string; to?: never; onClick?: never; disabled?: never; type?: never }
    | {
        onClick?: () => void
        disabled?: boolean
        type?: 'button' | 'submit'
        to?: never
        href?: never
      }
  )

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
    'font-semibold underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
    TONE[tone],
    SIZE[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

export function TextButton({
  children,
  icon,
  to,
  href,
  type = 'button',
  ...rest
}: TextButtonProps) {
  const { tone, size, className, onClick, disabled } = rest
  const classes = textButtonClasses({ tone, size, icon, className })

  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {icon}
        {children}
      </Link>
    )
  }
  if (href !== undefined) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {icon}
        {children}
      </a>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {icon}
      {children}
    </button>
  )
}
