import { useEffect, useRef, useState } from 'react'
import { DialogShell, type DialogProps, type DialogShellProps } from './DialogShell'

type ModalProps = DialogProps &
  Pick<DialogShellProps, 'role' | 'labelId' | 'descriptionId' | 'focusKey'>

const CLOSE_THRESHOLD = 120

/**
 * A bottom sheet on `DialogShell` (Radix Dialog). A dismissible sheet also closes on a drag down,
 * and shows a drag handle; a sheet that isn't dismissible hides it, since the gesture would do
 * nothing.
 */
export function Modal({ open, onClose, dismissible = true, ...rest }: ModalProps) {
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) setDragY(0)
  }, [open])

  function handleTouchStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartY.current === null) return
    const delta = e.touches[0].clientY - dragStartY.current
    // Finger moving down while content is scrolled = user wants to scroll back up, not close
    if (delta > 0 && (scrollRef.current?.scrollTop ?? 0) > 0) return
    if (delta > 0) setDragY(delta)
  }

  function handleTouchEnd() {
    if (dragY >= CLOSE_THRESHOLD) {
      setDragY(0)
      dragStartY.current = null
      onClose()
    } else {
      setDragY(0)
      dragStartY.current = null
    }
  }

  const style = {
    transform: `translateY(${dragY}px)`,
    transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
  }

  return (
    <DialogShell
      shape="sheet"
      open={open}
      onClose={onClose}
      dismissible={dismissible}
      bodyRef={scrollRef}
      drag={
        dismissible
          ? {
              style,
              onTouchStart: handleTouchStart,
              onTouchMove: handleTouchMove,
              onTouchEnd: handleTouchEnd,
            }
          : { style }
      }
      {...rest}
    />
  )
}
