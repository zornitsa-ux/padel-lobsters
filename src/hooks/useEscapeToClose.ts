import { useEffect } from 'react'

export function useEscapeToClose({
  active,
  onClose,
}: {
  active: boolean
  onClose: () => void
}): void {
  useEffect(() => {
    if (!active) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onClose])
}
