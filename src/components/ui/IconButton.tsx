import React from 'react'

/**
 * Filled variants sit on a tinted square. `ghost` is a bare muted icon for close, back,
 * refresh and reorder; `ghost-destructive` is the same for delete and remove in a row.
 */
type Variant = 'neutral' | 'destructive' | 'accent' | 'success' | 'ghost' | 'ghost-destructive'
/** `md` (36px) is the default; `sm` (32px) for rows and inline controls. */
type Size = 'sm' | 'md'

interface IconButtonProps {
  /** Icon element. The button sets its size; colour comes from the variant. */
  children: React.ReactNode
  /** Required: these buttons have no visible text. */
  'aria-label': string
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  /** When set the control renders as an anchor instead of a button. */
  href?: string
  target?: string
  rel?: string
  variant?: Variant
  size?: Size
  title?: string
  disabled?: boolean
  /** Layout only (positioning, margins). */
  className?: string
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup']
  'aria-expanded'?: boolean
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
}

const SIZE: Record<Size, string> = {
  sm: 'w-8 h-8 [&>svg]:size-3.5',
  md: 'w-9 h-9 [&>svg]:size-4',
}

export function IconButton({
  children,
  onClick,
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
  const classes = `${SIZE[size]} ${BASE} ${VARIANT[variant]} ${className ?? ''}`.trim()

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        title={title}
        className={classes}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  )
}
