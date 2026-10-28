import { useEffect, useRef, type RefObject } from 'react'

const NOT_SKIPPED = ':not([tabindex="-1"])'
const TABBABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]',
]
  .map((selector) => selector + NOT_SKIPPED)
  .join(', ')

const inDocumentOrder = (a: Node, b: Node) =>
  a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

/** Elements Tab can reach inside `root`, in document order. Skips hidden ones where the browser can tell. */
export const tabbablesIn = ({ root }: { root: HTMLElement | null }) =>
  Array.from(root?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])
    .filter((element) => element.checkVisibility?.() ?? true)
    // jsdom returns a selector list grouped by selector rather than in document order.
    .sort(inDocumentOrder)

/** Focuses the first or last tabbable element in `sheet`, or the sheet itself when it has none. */
export function focusEdge({ sheet, edge }: { sheet: HTMLElement | null; edge: 'first' | 'last' }) {
  const items = tabbablesIn({ root: sheet })
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
