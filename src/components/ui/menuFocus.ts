export const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)'

/** Index to focus after an arrow, Home or End key, or null for any other key. */
export function nextItemIndex({
  key,
  index,
  count,
}: {
  key: string
  index: number
  count: number
}): number | null {
  if (count === 0) return null
  if (key === 'ArrowDown') return index < 0 ? 0 : (index + 1) % count
  if (key === 'ArrowUp') return index < 0 ? count - 1 : (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

export const itemsIn = (list: HTMLElement | null) =>
  Array.from(list?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])

/** Moves focus to the first enabled item of a list, e.g. on ArrowDown from a search field. */
export function focusFirstItem(list: HTMLElement | null) {
  itemsIn(list)[0]?.focus()
}
