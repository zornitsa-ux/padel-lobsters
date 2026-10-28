import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { focusFirstItem, ITEM_SELECTOR, itemsIn, nextItemIndex } from './menuFocus'

type Align = 'left' | 'right' | 'stretch'

const ALIGN: Record<Align, string> = {
  right: 'right-0 w-max min-w-44 max-w-72',
  left: 'left-0 w-max min-w-44 max-w-72',
  stretch: 'inset-x-0',
}

interface MenuListProps {
  /** Accessible name of the menu. */
  label: string
  /** Show `label` as a heading above the items. */
  showLabel?: boolean
  align?: Align
  /** Called after an item is chosen. */
  onItemSelected?: () => void
  /** Tab leaves the menu. */
  onTab?: () => void
  /** Keep focus in the field that opened the list (a search input) when an item is tapped. */
  keepFocus?: boolean
  /** Focus the first item on mount. */
  autoFocus?: boolean
  listRef?: React.RefObject<HTMLDivElement>
  children: React.ReactNode
}

/**
 * The floating panel of a menu, placed under its parent (`relative`). `Menu` wraps it with a
 * trigger; a search field that suggests items renders it directly.
 */
export function MenuList({
  label,
  showLabel = false,
  align = 'right',
  onItemSelected,
  onTab,
  keepFocus = false,
  autoFocus = false,
  listRef,
  children,
}: MenuListProps) {
  const ownRef = useRef<HTMLDivElement>(null)
  const ref = listRef ?? ownRef

  useEffect(() => {
    if (autoFocus) focusFirstItem(ref.current)
  }, [autoFocus, ref])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      onTab?.()
      return
    }
    const items = itemsIn(ref.current)
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = nextItemIndex({ key: event.key, index, count: items.length })
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  const handleClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest(ITEM_SELECTOR)) onItemSelected?.()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
      className={`absolute top-full z-50 mt-1 py-1 max-h-60 overflow-y-auto rounded-xl bg-white border border-lob-line shadow-xl ${ALIGN[align]}`}
    >
      {showLabel && (
        <div
          aria-hidden="true"
          className="px-4 pt-1.5 pb-1 text-2xs font-bold uppercase tracking-wider text-lob-muted-light"
        >
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

export interface MenuTriggerProps {
  onClick: () => void
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
}

interface MenuProps {
  /** Accessible name of the menu. */
  label: string
  /** Show `label` as a heading above the items. */
  showLabel?: boolean
  /** Which edge of the trigger the menu lines up with. */
  align?: 'left' | 'right'
  /** Renders the trigger: spread the props onto a `Button` or `IconButton`. */
  trigger: (props: MenuTriggerProps) => React.ReactNode
  /** `MenuItem`s, optionally split by `MenuSeparator`. */
  children: React.ReactNode
}

/**
 * A button that opens a list of actions. Escape and choosing an item close it and return
 * focus to the trigger; a tap outside closes it; arrow keys, Home and End move between items.
 */
export function Menu({ label, showLabel, align = 'right', trigger, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const focusTrigger = useCallback(
    () => rootRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus(),
    [],
  )
  const closeToTrigger = useCallback(() => {
    setOpen(false)
    focusTrigger()
  }, [focusTrigger])

  useEscapeToClose({ active: open, onClose: closeToTrigger })

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <MenuList
            label={label}
            showLabel={showLabel}
            align={align}
            autoFocus
            onItemSelected={closeToTrigger}
            onTab={() => {
              // Focus the trigger before the browser moves on, so Tab continues from it.
              focusTrigger()
              setOpen(false)
            }}
          >
            {children}
          </MenuList>
        </>
      )}
    </div>
  )
}

type Tone = 'default' | 'danger'

interface MenuItemProps {
  /** The item's label. */
  children: React.ReactNode
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

/** One action in a `Menu` (or a `MenuList`). The menu closes after `onSelect`. */
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
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
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
    </button>
  )
}

/** A rule between groups of items. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-lob-line" />
}
