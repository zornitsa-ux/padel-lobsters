import React from 'react'

type Variant = 'primary' | 'secondary' | 'neutral' | 'danger'
/** `lg` is the default CTA. `md` is about 40px tall, so keep it for secondary inline actions. */
type Size = 'md' | 'lg'

interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children'
> {
  children: React.ReactNode
  variant?: Variant
  size?: Size
  /** Leading icon; sizing stays with the caller. */
  icon?: React.ReactNode
  /** Layout only (`w-full`, `flex-1`, margins). Size and colour come from the props. */
  className?: string
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full border-2 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-lob-coral text-white border-transparent shadow-lg hover:shadow-xl hover:bg-opacity-90',
  secondary: 'bg-white text-lob-teal border-lob-teal hover:bg-lob-teal-light',
  neutral: 'bg-lob-well text-lob-slate border-lob-line-strong hover:bg-lob-line',
  danger: 'bg-lob-danger-solid text-white border-transparent shadow-md hover:bg-lob-danger-strong',
}

const SIZE: Record<Size, string> = {
  md: 'py-2 px-4 text-sm',
  lg: 'py-3 px-5',
}

function buttonClasses({
  variant = 'primary',
  size = 'lg',
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
}) {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className ?? ''}`.trim()
}

export function Button({
  children,
  variant,
  size,
  icon,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </button>
  )
}
