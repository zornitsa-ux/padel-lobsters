import { useEffect, useRef, useState } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90dvh]"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
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
