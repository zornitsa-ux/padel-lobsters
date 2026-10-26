import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Filled variants sit on a tinted square. `ghost` is a bare muted icon for close, back,
 * refresh and reorder; `ghost-destructive` is the same for delete and remove in a row.
 * `on-dark` is a translucent square for dark surfaces (app header, lightbox).
 */
type Variant =
  | 'neutral'
  | 'destructive'
  | 'accent'
  | 'success'
  | 'ghost'
  | 'ghost-destructive'
  | 'on-dark'
/** `md` (40px, matching `Button md`) is the default; `sm` (32px) for rows and inline controls. */
type Size = 'sm' | 'md'

interface IconButtonProps {
  /** Icon element. The button sets its size; colour comes from the variant. */
  children: React.ReactNode
  /** Required: these buttons have no visible text. Also the default tooltip. */
  'aria-label': string
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  /** In-app navigation: renders a router Link. */
  to?: string
  /** Renders a plain anchor. */
  href?: string
  target?: string
  rel?: string
  variant?: Variant
  size?: Size
  /** Tooltip; defaults to `aria-label`. */
  title?: string
  /** A disabled `to` / `href` renders as a disabled button, so it can't navigate. */
  disabled?: boolean
  /** Layout only (positioning, margins). */
  className?: string
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup']
  'aria-expanded'?: boolean
  'aria-pressed'?: boolean
}

const BASE =
  'flex shrink-0 items-center justify-center rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none'

const VARIANT: Record<Variant, string> = {
  neutral: 'bg-lob-teal-light text-lob-muted',
  destructive: 'bg-lob-danger-light text-lob-danger-solid',
  accent: 'bg-lob-cream text-lob-teal',
  success: 'bg-lob-success-light text-lob-success-solid',
  ghost: 'text-lob-muted-light hover:text-lob-slate hover:bg-lob-line',
  'ghost-destructive': 'text-lob-muted-light hover:text-lob-danger-solid hover:bg-lob-danger-light',
  'on-dark': 'bg-white/15 text-white backdrop-blur hover:bg-white/25',
}

const SIZE: Record<Size, string> = {
  sm: 'w-8 h-8 [&>svg]:size-3.5',
  md: 'w-10 h-10 [&>svg]:size-4',
}

export function IconButton({
  children,
  to,
  href,
  target,
  rel,
  variant = 'neutral',
  size = 'md',
  title,
  disabled,
  className,
  ...rest
}: IconButtonProps) {
  const shared = {
    ...rest,
    title: title ?? rest['aria-label'],
    className: `${SIZE[size]} ${BASE} ${VARIANT[variant]} ${className ?? ''}`.trim(),
  }

  if (to && !disabled) {
    return (
      <Link to={to} {...shared}>
        {children}
      </Link>
    )
  }

  if (href && !disabled) {
    return (
      <a href={href} target={target} rel={rel} {...shared}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" disabled={disabled} {...shared}>
      {children}
    </button>
  )
}
