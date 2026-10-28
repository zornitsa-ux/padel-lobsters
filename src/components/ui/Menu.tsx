import React, { createContext, forwardRef, useCallback, useContext, useRef } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { itemsIn, nextItemIndex } from './menuFocus'

const PANEL =
  'py-1 max-h-60 overflow-y-auto rounded-xl bg-white border border-lob-line shadow-xl [&>[role=separator]]:my-1'

function MenuHeading({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="px-4 pt-1.5 pb-1 text-2xs font-bold uppercase tracking-wider text-lob-muted-light"
    >
      {label}
    </div>
  )
}

interface MenuListProps {
  /** Accessible name of the list. */
  label: string
  id?: string
  listRef?: React.RefObject<HTMLDivElement>
  children: React.ReactNode
}

/**
 * Suggestions under a search field, placed full width under its parent (`relative`). Tapping an
 * item keeps focus in the field; arrow keys, Home and End move between items. The field owns
 * opening, closing and Escape.
 */
export function MenuList({ label, id, listRef, children }: MenuListProps) {
  const ownRef = useRef<HTMLDivElement>(null)
  const ref = listRef ?? ownRef

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const items = itemsIn(ref.current)
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = nextItemIndex({ key: event.key, index, count: items.length })
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => event.preventDefault()}
      className={`absolute top-full inset-x-0 z-50 mt-1 ${PANEL}`}
    >
      {children}
    </div>
  )
}

export interface MenuTriggerProps {
  id?: string
  type?: 'button'
  disabled?: boolean
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
  'aria-controls'?: string
  onPointerDown?: React.PointerEventHandler<HTMLElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
}

type TriggerSlotProps = MenuTriggerProps & {
  render: (props: MenuTriggerProps) => React.ReactNode
}

// Radix needs the trigger's DOM node, and `Button` / `IconButton` don't forward refs, so the
// node is read through a `display: contents` wrapper.
const TriggerSlot = forwardRef<HTMLElement, TriggerSlotProps>(function TriggerSlot(
  { render, ...props },
  ref,
) {
  const setRef = useCallback(
    (span: HTMLSpanElement | null) => {
      const node = (span?.firstElementChild as HTMLElement | null) ?? null
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  return (
    <span ref={setRef} className="contents">
      {render(props)}
    </span>
  )
})

/** Set inside a `Menu`: items hand their action to it rather than running it on click. */
const RunAfterClose = createContext<((action: () => void) => void) | null>(null)

interface MenuProps {
  /** Accessible name of the menu. */
  label: string
  /** Show `label` as a heading above the items. */
  showLabel?: boolean
  /** Which edge of the trigger the menu lines up with. */
  align?: 'left' | 'right'
  /** Renders the trigger: spread the props onto a `Button` or `IconButton`. */
  trigger: (props: MenuTriggerProps) => React.ReactNode
  children: React.ReactNode
}

/**
 * A button that opens a list of actions (`MenuItem`s, optionally split by `MenuSeparator`), on
 * Radix DropdownMenu. Escape, a tap outside and choosing an item close it and return focus to
 * the trigger. Escape stops at the menu, so a panel around it stays open.
 */
export function Menu({ label, showLabel = false, align = 'right', trigger, children }: MenuProps) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const chosen = useRef<(() => void) | null>(null)
  const runAfterClose = useCallback((action: () => void) => {
    chosen.current = action
  }, [])

  // The chosen action runs once the menu is gone and the trigger has focus again, so a dialog it
  // opens returns focus to the trigger, and a field it focuses keeps focus.
  const handleCloseAutoFocus = (event: Event) => {
    const action = chosen.current
    if (!action) return
    chosen.current = null
    event.preventDefault()
    triggerRef.current?.focus()
    action()
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <TriggerSlot ref={triggerRef} render={trigger} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align === 'left' ? 'start' : 'end'}
          sideOffset={4}
          collisionPadding={8}
          loop
          aria-label={label}
          // Radix names the menu after its trigger.
          aria-labelledby={undefined}
          // Radix closes the menu but lets the key go on to `window` listeners (SwapPanel,
          // CompareView, the Oscars drawer), which would close the panel too.
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={handleCloseAutoFocus}
          className={`z-50 w-max min-w-44 max-w-72 ${PANEL}`}
        >
          {showLabel && <MenuHeading label={label} />}
          <RunAfterClose.Provider value={runAfterClose}>{children}</RunAfterClose.Provider>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface ItemButtonProps {
  onSelect: () => void
  disabled: boolean
  className: string
  children: React.ReactNode
}

/** A Radix item inside a `Menu`; a plain button inside a `MenuList`. */
function ItemButton({ onSelect, disabled, className, children }: ItemButtonProps) {
  const runAfterClose = useContext(RunAfterClose)
  const button = (
    <button
      type="button"
      role="menuitem"
      onClick={runAfterClose ? undefined : onSelect}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  )
  if (!runAfterClose) return button
  return (
    <DropdownMenu.Item asChild disabled={disabled} onSelect={() => runAfterClose(onSelect)}>
      {button}
    </DropdownMenu.Item>
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

/** One action in a `Menu` (or a `MenuList`). The menu closes, then `onSelect` runs. */
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
