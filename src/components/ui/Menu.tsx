import React, { forwardRef, useCallback, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MENU_PANEL, MenuItemShell, type ItemButtonProps } from './menuShell'

export { MenuItem, MenuSeparator } from './MenuItem'

export interface MenuTriggerProps {
  id?: string
  type?: 'button'
  disabled?: boolean
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
  'aria-controls'?: string
  onPointerDown?: React.PointerEventHandler<HTMLElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  onClick?: React.MouseEventHandler<HTMLElement>
}

type TriggerSlotProps = MenuTriggerProps & {
  render: (props: MenuTriggerProps) => React.ReactNode
}

// Radix needs the trigger's DOM node, and `Button` / `IconButton` don't forward refs, so the
// node is read through a `display: contents` wrapper: the render's first element.
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

interface MenuProps {
  /** Accessible name of the menu. */
  label: string
  /** Show `label` as a heading above the items. */
  showLabel?: boolean
  /** Which edge of the trigger the menu lines up with. */
  align?: 'left' | 'right'
  /** Renders the trigger as one element: spread the props onto a `Button` or `IconButton`. */
  trigger: (props: MenuTriggerProps) => React.ReactNode
  children: React.ReactNode
}

/**
 * A button that opens a list of actions (`MenuItem`s, optionally split by `MenuSeparator`), on
 * Radix DropdownMenu. Escape, a tap outside and choosing an item close it and return focus to
 * the trigger. Escape stops at the menu, so a panel around it stays open.
 */
export function Menu({ label, showLabel = false, align = 'right', trigger, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const pressedWith = useRef('')
  const chosen = useRef<(() => void) | null>(null)

  const RadixItem = useCallback(
    ({ onSelect, disabled, className, children: content }: ItemButtonProps) => (
      <DropdownMenu.Item
        asChild
        disabled={disabled}
        onSelect={() => {
          chosen.current = onSelect
        }}
      >
        <button type="button" disabled={disabled} className={className}>
          {content}
        </button>
      </DropdownMenu.Item>
    ),
    [],
  )

  // Radix refocuses the trigger after this handler; the action runs once it has, so a dialog it
  // opens returns focus to the trigger, and a field it focuses keeps focus.
  const handleCloseAutoFocus = () => {
    const action = chosen.current
    chosen.current = null
    if (action) queueMicrotask(action)
  }

  // Radix opens on pointer down. A finger there may be starting a scroll, so touch and pen open
  // on click instead.
  const handlePointerDown = (event: React.PointerEvent) => {
    pressedWith.current = event.pointerType
    if (event.pointerType !== 'mouse') event.preventDefault()
  }
  const handleClick = () => {
    const pressed = pressedWith.current
    pressedWith.current = ''
    if (pressed && pressed !== 'mouse') setOpen((o) => !o)
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild onPointerDown={handlePointerDown} onClick={handleClick}>
        <TriggerSlot render={trigger} />
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
          className={`z-50 w-max min-w-44 max-w-72 ${MENU_PANEL}`}
        >
          {showLabel && (
            <div
              aria-hidden="true"
              className="px-4 pt-1.5 pb-1 text-2xs font-bold uppercase tracking-wider text-lob-muted-light"
            >
              {label}
            </div>
          )}
          <MenuItemShell.Provider value={RadixItem}>{children}</MenuItemShell.Provider>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
