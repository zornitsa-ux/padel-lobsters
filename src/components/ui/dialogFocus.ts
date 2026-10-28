import { useLayoutEffect, useRef } from 'react'

// Not a menu trigger: it has no Escape handler of its own, the open menu does.
const OPEN_POPUP = '[role="menu"], input[aria-haspopup][aria-expanded="true"]'

/** Escape from inside an open popup (a menu, or a field whose list is showing) closes that first. */
export const escapeIsForPopup = ({ target }: { target: EventTarget | null }) =>
  target instanceof Element && target.closest(OPEN_POPUP) !== null

/** Inside the toast viewport (`Toast.tsx` marks it with `data-toast-viewport`). */
export const isToast = ({ target }: { target: EventTarget | null }) =>
  target instanceof Element && target.closest('[data-toast-viewport]') !== null

/**
 * Remembers what had focus when the dialog opened and returns an `onCloseAutoFocus` handler that
 * puts it back, unless focus has since moved somewhere else. Radix returns focus only to a
 * `Dialog.Trigger`, and our dialogs open from code.
 */
export function useReturnFocus({ open }: { open: boolean }) {
  const opener = useRef<HTMLElement | null>(null)

  // Radix's Portal mounts the sheet in a render after this commit, so the opener still has focus
  // here, even when an autoFocus child is about to take it.
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null
  }, [open])

  return (event: Event) => {
    event.preventDefault()
    const active = document.activeElement
    if (active && active !== document.body) return
    if (opener.current?.isConnected) opener.current.focus()
  }
}
