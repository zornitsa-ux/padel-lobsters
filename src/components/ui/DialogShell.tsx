import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { escapeIsForPopup, isToast, useReturnFocus } from './dialogFocus'

/** Props every dialog shape takes (`Modal`, `FullScreenDialog`, `Drawer`). */
export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  /** A line under the title; it also describes the dialog. */
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /**
   * Escape and a backdrop tap close the dialog (a drag down too, for the sheet). Set false for long
   * forms, where a mis-tap would discard typed input; closing then goes through an explicit control.
   */
  dismissible?: boolean
}

export type DialogShape = 'sheet' | 'fullscreen' | 'drawer'

export interface DialogShellProps extends DialogProps {
  shape: DialogShape
  /** `alertdialog` for a confirmation that interrupts the flow. */
  role?: 'dialog' | 'alertdialog'
  /** Without a `title`: id of the heading or text inside that names the dialog. */
  labelId?: string
  /** Without a `description`: id of the text that describes the dialog. */
  descriptionId?: string
  /** Changing it moves focus as on open again, for a dialog that stays open across requests. */
  focusKey?: string | number
  /** The sheet's drag-to-dismiss: a transform and touch handlers on the dialog. */
  drag?: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    'style' | 'onTouchStart' | 'onTouchMove' | 'onTouchEnd'
  >
  bodyRef?: React.Ref<HTMLDivElement>
}

const OVERLAY: Record<DialogShape, string> = {
  sheet: 'fixed inset-0 z-50 bg-black/60 flex items-end justify-center',
  fullscreen: 'fixed inset-0 z-50 bg-white',
  drawer: 'fixed inset-0 z-50 bg-black/60 flex justify-end',
}

const CONTENT: Record<DialogShape, string> = {
  sheet: 'w-full max-w-lg max-h-[90dvh] bg-white rounded-t-3xl shadow-xl',
  fullscreen: 'mx-auto h-full w-full max-w-2xl bg-white',
  drawer: 'h-full w-72 max-w-[85%] bg-white shadow-xl',
}

/** The sheet goes with its drag handle; the others close with an X in the header. */
const HAS_CLOSE: Record<DialogShape, boolean> = { sheet: false, fullscreen: true, drawer: true }

function DialogHeader({
  title,
  description,
  onClose,
}: {
  title: string
  description?: string
  onClose?: () => void
}) {
  return (
    <div className="px-5 py-3 border-b border-lob-line flex items-center justify-between gap-4 flex-shrink-0">
      <div>
        <Dialog.Title className="font-semibold text-lob-dark text-base">{title}</Dialog.Title>
        {description && (
          <Dialog.Description className="text-xs text-lob-muted mt-0.5">
            {description}
          </Dialog.Description>
        )}
      </div>
      {onClose && (
        <IconButton variant="ghost" aria-label="Close" onClick={onClose}>
          <X />
        </IconButton>
      )}
    </div>
  )
}

/**
 * The Radix Dialog every shape builds on. On open, focus moves to the child marked
 * `data-autofocus`, or else the dialog itself. Tab stays inside, the page behind is hidden from
 * assistive tech and doesn't scroll, and focus returns to the opener on close. A dialog opened
 * from inside another takes Escape and outside taps alone.
 */
export function DialogShell({
  shape,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  role = 'dialog',
  labelId,
  descriptionId,
  focusKey,
  drag,
  bodyRef,
}: DialogShellProps) {
  const returnFocus = useReturnFocus({ open })

  // Radix hears Escape on the document before anything inside the dialog does, and gives it only to
  // the top layer (a menu, or a dialog opened from inside this one).
  function handleEscape(e: KeyboardEvent) {
    // An open search list's own handler closes it; Escape during IME composition belongs to the IME.
    if (!dismissible || e.isComposing || escapeIsForPopup({ target: e.target })) e.preventDefault()
  }

  // Not the first field, which would pop the keyboard on a phone. React's autoFocus also works,
  // but not in a dialog opened from inside another, whose trap pulls it back before this runs.
  function focusFirst(e: Event) {
    e.preventDefault()
    const dialog = e.currentTarget as HTMLElement
    ;(dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog).focus()
  }

  // A tap on a toast (its dismiss X) isn't a tap on the page behind. The full-screen dialog has no
  // page behind: a tap beside its column is still on it.
  const handleInteractOutside = (e: Event) => {
    if (!dismissible || shape === 'fullscreen' || isToast({ target: e.target })) e.preventDefault()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={OVERLAY[shape]}
          // A tap on the backdrop would otherwise drop focus to the page behind.
          onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
        >
          <Dialog.Content
            key={focusKey}
            role={role}
            {...(title ? {} : { 'aria-labelledby': labelId })}
            {...(description ? {} : { 'aria-describedby': descriptionId })}
            className={`${CONTENT[shape]} flex flex-col outline-none`}
            onOpenAutoFocus={focusFirst}
            onCloseAutoFocus={returnFocus}
            onEscapeKeyDown={handleEscape}
            onInteractOutside={handleInteractOutside}
            // The dialog is portaled, but React events still bubble to whatever renders it.
            onClick={(e) => e.stopPropagation()}
            {...drag}
          >
            {shape === 'sheet' &&
              (dismissible ? (
                <div className="w-10 h-1 bg-lob-line-strong rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
              ) : (
                // Matches the handle's total height so the header keeps its gap
                // from the rounded top edge.
                <div className="h-6 flex-shrink-0" />
              ))}
            {title && (
              <DialogHeader
                title={title}
                description={description}
                onClose={HAS_CLOSE[shape] ? onClose : undefined}
              />
            )}
            <div ref={bodyRef} className="px-5 py-4 flex-1 overflow-y-auto">
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
