import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { escapeIsForPopup, isToast, useReturnFocus } from './dialogFocus'

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
  /** Without a `title`: id of the heading or text inside that names the dialog. */
  labelId?: string
  /** Id of the text that describes the dialog. */
  descriptionId?: string
  /** Changing it moves focus as on open again, for a dialog that stays open across requests. */
  focusKey?: string | number
}

/**
 * A bottom sheet on Radix Dialog. On open, focus moves to the child marked `data-autofocus`, or
 * else the sheet itself. Tab stays inside, the page behind is hidden from assistive tech, and
 * focus returns to the opener on close. Escape stops at the sheet, so a panel behind it stays
 * open.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  role = 'dialog',
  labelId,
  descriptionId,
  focusKey,
}: ModalProps) {
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const returnFocus = useReturnFocus({ open })

  useEffect(() => {
    if (!open) setDragY(0)
  }, [open])

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

  // Radix hears Escape on the document before anything inside the sheet does.
  function handleEscape(e: KeyboardEvent) {
    // An open popup's own handler closes it and stops the event there.
    if (escapeIsForPopup({ target: e.target })) {
      e.preventDefault()
      return
    }
    e.stopPropagation()
    if (e.isComposing) {
      e.preventDefault()
      return
    }
    if (!dismissible) e.preventDefault()
  }

  // Not the first field, which would pop the keyboard on a phone. React's autoFocus also works,
  // but not in a dialog opened from inside another, whose trap pulls it back before this runs.
  function focusFirst(e: Event) {
    e.preventDefault()
    const sheet = e.currentTarget as HTMLElement
    ;(sheet.querySelector<HTMLElement>('[data-autofocus]') ?? sheet).focus()
  }

  // A tap on a toast (its dismiss X) isn't a tap on the page behind.
  const handleInteractOutside = (e: Event) => {
    if (!dismissible || isToast({ target: e.target })) e.preventDefault()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          // A tap on the backdrop would otherwise drop focus to the page behind.
          onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
        >
          <Dialog.Content
            key={focusKey}
            role={role}
            {...(title ? {} : { 'aria-labelledby': labelId })}
            aria-describedby={descriptionId}
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90dvh] outline-none"
            style={{
              transform: `translateY(${dragY}px)`,
              transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
            }}
            onOpenAutoFocus={focusFirst}
            onCloseAutoFocus={returnFocus}
            onEscapeKeyDown={handleEscape}
            onInteractOutside={handleInteractOutside}
            // The sheet is portaled, but React events still bubble to whatever renders it.
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
              <Dialog.Title className="px-5 py-3 border-b border-lob-line font-semibold text-lob-dark text-base">
                {title}
              </Dialog.Title>
            )}
            <div ref={scrollRef} className="px-5 py-4 flex-1 overflow-y-auto">
              {children}
            </div>
            {footer && (
              <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-lob-line flex-shrink-0">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
