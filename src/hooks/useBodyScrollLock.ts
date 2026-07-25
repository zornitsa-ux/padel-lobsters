import { useEffect } from 'react'

// Captures the body's overflow value at the moment this becomes active and
// restores exactly that value on cleanup — so a nested overlay closing while
// an outer one is still open (both requesting `hidden`) doesn't unlock the
// page out from under the outer one.
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])
}
