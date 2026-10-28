import React, { useContext } from 'react'
import { MenuItemShell, type ItemButtonProps } from './menuShell'

function ItemButton({ onSelect, disabled, className, children }: ItemButtonProps) {
  const Shell = useContext(MenuItemShell)
  if (Shell) {
    return (
      <Shell onSelect={onSelect} disabled={disabled} className={className}>
        {children}
      </Shell>
    )
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  )
}

type Tone = 'default' | 'danger'

interface MenuItemProps {
  /** The item's label. */
  children: React.ReactNode
  /** In a `Menu`, runs after the menu has closed (a tick after the tap), not inside the click. */
  onSelect: () => void
  /** Icon or avatar before the label. The item sizes a bare icon. */
  icon?: React.ReactNode
  /** Second line under the label. */
  hint?: React.ReactNode
  tone?: Tone
  /** The value already in effect: disabled, marked "· current". */
  current?: boolean
  disabled?: boolean
}

const TONE: Record<Tone, { text: string; icon: string }> = {
  default: {
    text: 'text-lob-slate enabled:hover:bg-lob-well focus-visible:bg-lob-well',
    icon: 'text-lob-muted-light',
  },
  danger: {
    text: 'text-lob-danger enabled:hover:bg-lob-danger-light focus-visible:bg-lob-danger-light',
    icon: 'text-lob-danger-solid',
  },
}

const ITEM =
  'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-left outline-none disabled:text-lob-muted-light disabled:cursor-default'

/** One action in a `Menu` (or a `MenuList`). */
export function MenuItem({
  children,
  onSelect,
  icon,
  hint,
  tone = 'default',
  current = false,
  disabled = false,
}: MenuItemProps) {
  const toneClasses = TONE[tone]
  return (
    <ItemButton
      onSelect={onSelect}
      disabled={disabled || current}
      className={`${ITEM} ${toneClasses.text}`}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={`flex flex-shrink-0 [&>svg]:size-4 ${current || disabled ? '' : toneClasses.icon}`}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="break-words">{children}</span>
          {current && <span className="text-2xs font-semibold flex-shrink-0">· current</span>}
        </span>
        {hint && <span className="block text-xs font-normal text-lob-muted">{hint}</span>}
      </span>
    </ItemButton>
  )
}

/** A rule between groups of items. */
export function MenuSeparator() {
  return <div role="separator" className="border-t border-lob-line" />
}
