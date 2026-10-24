import React from 'react'

type Variant = 'neutral' | 'destructive' | 'accent' | 'success'
type Size = 'sm' | 'md'

interface IconButtonProps {
  /** Icon element — sizing stays with the caller, colour comes from the variant. */
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
  className?: string
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup']
  'aria-expanded'?: boolean
}

const VARIANT: Record<Variant, string> = {
  neutral: 'bg-lob-teal-light text-lob-muted',
  destructive: 'bg-lob-danger-light text-lob-danger-solid',
  accent: 'bg-lob-cream text-lob-teal',
  success: 'bg-lob-success-light text-lob-success-solid',
}

const SIZE: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
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
  const classes =
    `${SIZE[size]} flex items-center justify-center rounded-xl ${VARIANT[variant]} active:scale-95 transition-all ${className ?? ''}`.trim()

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
