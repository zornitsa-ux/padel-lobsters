import React, { useRef } from 'react'
import { MENU_PANEL } from './menuShell'
import { itemsIn, nextItemIndex } from './menuFocus'

interface MenuListProps {
  /** Accessible name of the list. */
  label: string
  id?: string
  listRef?: React.RefObject<HTMLDivElement>
  children: React.ReactNode
}

/**
 * Suggestions (`MenuItem`s) under a search field, placed full width under its parent
 * (`relative`). Tapping an item keeps focus in the field; arrow keys, Home and End move between
 * items. The field owns opening, closing and Escape.
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
      className={`absolute top-full inset-x-0 z-50 mt-1 ${MENU_PANEL}`}
    >
      {children}
    </div>
  )
}
