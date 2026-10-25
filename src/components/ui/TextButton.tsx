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

type AnchorAttributes = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'className' | 'children' | 'href'
>
type ButtonAttributes = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children'
>

type TextButtonProps = TextButtonContentProps &
  (
    | (AnchorAttributes & { to: string; href?: never })
    | (AnchorAttributes & { href: string; to?: never })
    | (ButtonAttributes & { to?: never; href?: never })
  )

const TONE: Record<Tone, string> = {
  accent: 'text-lob-teal',
  primary: 'text-lob-coral',
  destructive: 'text-lob-danger',
  warning: 'text-lob-warning',
  neutral: 'text-lob-muted enabled:hover:text-lob-slate',
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

export function TextButton(props: TextButtonProps) {
  const { children, tone, size, icon, className, ...rest } = props
  const classes = textButtonClasses({ tone, size, icon, className })
  const content = (
    <>
      {icon}
      {children}
    </>
  )

  if (rest.to !== undefined) {
    return (
      <Link {...rest} className={classes}>
        {content}
      </Link>
    )
  }
  if (rest.href !== undefined) {
    return (
      <a target="_blank" rel="noopener noreferrer" {...rest} className={classes}>
        {content}
      </a>
    )
  }
  const { type = 'button', ...button } = rest
  return (
    <button type={type} {...button} className={classes}>
      {content}
    </button>
  )
}
