import { useRef } from 'react'

const OPEN_POPUP = '[role="menu"], [aria-haspopup][aria-expanded="true"]'

/** Escape from inside an open popup (a menu, or a field whose list is showing) closes that first. */
export const escapeIsForPopup = ({ target }: { target: EventTarget | null }) =>
  target instanceof Element && target.closest(OPEN_POPUP) !== null

/**
 * Remembers what had focus when the dialog opened and returns an `onCloseAutoFocus` handler that
 * puts it back, unless focus has since moved somewhere else. Radix returns focus only to a
 * `Dialog.Trigger`, and our dialogs open from code.
 */
export function useReturnFocus({ open }: { open: boolean }) {
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)

  // Read during render: an autoFocus child takes focus at commit, before any effect runs.
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null
  wasOpen.current = open

  return (event: Event) => {
    event.preventDefault()
    const active = document.activeElement
    if (active && active !== document.body) return
    if (opener.current?.isConnected) opener.current.focus()
  }
}
