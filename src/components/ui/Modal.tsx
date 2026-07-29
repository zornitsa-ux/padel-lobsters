import { useEffect, useRef, useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /**
   * Backdrop tap and drag-down close the sheet. Set false for long forms,
   * where a mis-tap would discard typed input — closing then has to go
   * through an explicit control. The drag handle is hidden too, since it
   * advertises a gesture that would no longer do anything.
   */
  dismissible?: boolean
}

export function Modal({ open, onClose, title, children, footer, dismissible = true }: ModalProps) {
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) setDragY(0)
  }, [open])

  if (!open) return null

  const CLOSE_THRESHOLD = 120

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

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90dvh]"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={dismissible ? handleTouchStart : undefined}
        onTouchMove={dismissible ? handleTouchMove : undefined}
        onTouchEnd={dismissible ? handleTouchEnd : undefined}
      >
        {dismissible ? (
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
        ) : (
          // Matches the handle's total height so the header keeps its gap
          // from the rounded top edge.
          <div className="h-6 flex-shrink-0" />
        )}
        {title && (
          <div className="px-5 py-3 border-b border-gray-100 font-semibold text-lob-dark text-base">
            {title}
          </div>
        )}
        <div ref={scrollRef} className="px-5 py-4 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
