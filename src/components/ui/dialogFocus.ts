import { useEffect, useRef, type RefObject } from 'react'

const TABBABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** Elements Tab can reach inside `root`, in document order. Skips hidden ones where the browser can tell. */
export const tabbablesIn = (root: HTMLElement | null) =>
  // Matching each element, not querySelectorAll(TABBABLE): jsdom groups that by selector.
  Array.from(root?.querySelectorAll<HTMLElement>('*') ?? []).filter(
    (element) => element.matches(TABBABLE) && (element.checkVisibility?.() ?? true),
  )

/** Focuses the first or last tabbable element in `sheet`, or the sheet itself when it has none. */
export function focusEdge({ sheet, edge }: { sheet: HTMLElement | null; edge: 'first' | 'last' }) {
  const items = tabbablesIn(sheet)
  const target = edge === 'first' ? items[0] : items[items.length - 1]
  ;(target ?? sheet)?.focus()
}

/**
 * While `open`, focus is in the sheet: on whatever an `autoFocus` child focused, otherwise on the
 * sheet itself. On close, focus returns to the element that had it before, if focus hasn't
 * since moved somewhere else.
 */
export function useDialogFocus({
  open,
  sheetRef,
}: {
  open: boolean
  sheetRef: RefObject<HTMLElement>
}) {
  const returnTo = useRef<HTMLElement | null>(null)
  const firstFocus = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)

  // Read during render: an autoFocus child takes focus at commit, before any effect runs.
  if (open && !wasOpen.current) {
    returnTo.current = document.activeElement as HTMLElement | null
    firstFocus.current = null
  }
  wasOpen.current = open

  useEffect(() => {
    const sheet = sheetRef.current
    if (!open || !sheet) return
    // Kept across StrictMode's effect replay, so an autoFocus child keeps focus in dev.
    firstFocus.current ??= sheet.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : sheet
    firstFocus.current.focus()
    const opener = returnTo.current
    return () => {
      const active = document.activeElement
      const focusLeft = active && active !== document.body && !sheet.contains(active)
      if (!focusLeft && opener?.isConnected) opener.focus()
    }
  }, [open, sheetRef])
}
