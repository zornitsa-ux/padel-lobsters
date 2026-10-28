import { createContext, type ComponentType, type ReactNode } from 'react'

/** The floating panel's look, shared by `Menu` and `MenuList`. */
export const MENU_PANEL =
  'py-1 max-h-60 overflow-y-auto rounded-xl bg-white border border-lob-line shadow-xl [&>[role=separator]]:my-1'

export interface ItemButtonProps {
  onSelect: () => void
  disabled: boolean
  className: string
  children: ReactNode
}

/**
 * Set by `Menu` to its Radix item. Kept apart from `MenuItem` so a `MenuList` (the TeamForm
 * search) doesn't load Radix.
 */
export const MenuItemShell = createContext<ComponentType<ItemButtonProps> | null>(null)
