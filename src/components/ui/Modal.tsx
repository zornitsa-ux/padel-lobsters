import { useEffect, useId, useRef, useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { focusEdge, useDialogFocus } from './dialogFocus'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /**
   * Backdrop tap, drag-down and Escape close the sheet. Set false for long forms,
   * where a mis-tap would discard typed input — closing then has to go
   * through an explicit control. The drag handle is hidden too, since it
   * advertises a gesture that would no longer do anything.
   */
  dismissible?: boolean
  /** `alertdialog` for a confirmation that interrupts the flow. */
  role?: 'dialog' | 'alertdialog'
  /** Id of the text that describes the dialog. It names the dialog when there is no `title`. */
  descriptionId?: string
}

/**
 * A bottom sheet. Focus moves into it on open (an `autoFocus` child chooses where), Tab stays
 * inside, and focus returns to the opener on close. Escape stops at the sheet, so a panel
 * behind it stays open.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  role = 'dialog',
  descriptionId,
}: ModalProps) {
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useBodyScrollLock(open)
  useDialogFocus({ open, sheetRef })

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Escape' || e.nativeEvent.isComposing) return
    e.stopPropagation()
    if (dismissible) onClose()
  }

  const focusGuard = ({ edge }: { edge: 'first' | 'last' }) => (
    <span
      tabIndex={0}
      data-focus-guard
      className="fixed outline-none"
      onFocus={() => focusEdge({ sheet: sheetRef.current, edge })}
    />
  )

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
      onClick={dismissible ? onClose : undefined}
      onKeyDown={handleKeyDown}
      // A tap on the backdrop would otherwise drop focus to the page behind.
      onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
    >
      {focusGuard({ edge: 'last' })}
      <div
        ref={sheetRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : descriptionId}
        aria-describedby={title ? descriptionId : undefined}
        tabIndex={-1}
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90dvh] outline-none"
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
          <div
            id={titleId}
            className="px-5 py-3 border-b border-lob-line font-semibold text-lob-dark text-base"
          >
            {title}
          </div>
        )}
        <div ref={scrollRef} className="px-5 py-4 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-lob-line flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
      {focusGuard({ edge: 'first' })}
    </div>
  )
}
