import React from 'react'
import { renderAction, type ActionProps } from './action'

/**
 * `danger` is for the confirming action of a destructive flow (the confirm dialog).
 * A destructive action that isn't the screen's CTA is `TextButton tone="destructive"`.
 */
type Variant = 'primary' | 'secondary' | 'neutral' | 'danger'
/** `md` (40px) is the default. `lg` (52px) for a screen's lead CTA; `sm` (32px) for dense rows. */
type Size = 'sm' | 'md' | 'lg'

interface ButtonContentProps {
  children: React.ReactNode
  variant?: Variant
  size?: Size
  /** Leading icon. The button sets its size. */
  icon?: React.ReactNode
  /** Layout only (`w-full`, `flex-1`, margins). Size and colour come from the props. */
  className?: string
}

type ButtonProps = ButtonContentProps & ActionProps

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full border-2 not-disabled:active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed [&>svg]:shrink-0'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-lob-coral text-white border-transparent shadow-lg not-disabled:hover:shadow-xl not-disabled:hover:bg-opacity-90',
  secondary: 'bg-white text-lob-teal border-lob-teal not-disabled:hover:bg-lob-teal-light',
  neutral: 'bg-lob-well text-lob-slate border-lob-line-strong not-disabled:hover:bg-lob-line',
  danger:
    'bg-lob-danger-solid text-white border-transparent shadow-md not-disabled:hover:bg-lob-danger-strong',
}

const SIZE: Record<Size, string> = {
  sm: 'py-1.5 px-3 text-xs [&>svg]:size-3.5',
  md: 'py-2 px-4 text-sm [&>svg]:size-4',
  lg: 'py-3 px-5 [&>svg]:size-5',
}

function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: Omit<ButtonContentProps, 'children' | 'icon'>) {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className ?? ''}`.trim()
}

export function Button({ children, variant, size, icon, className, ...props }: ButtonProps) {
  return renderAction({
    props,
    className: buttonClasses({ variant, size, className }),
    children: (
      <>
        {icon}
        {children}
      </>
    ),
  })
}
