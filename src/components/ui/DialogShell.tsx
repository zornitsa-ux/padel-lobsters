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

interface ShapeStyle {
  overlay: string
  content: string
  /** Lines up the header, body and footer content; the dialog itself spans the overlay. */
  column: string
  /** The sheet shows a drag handle; the others close with an X in the header. */
  closeWith: 'handle' | 'button'
}

const SHAPES: Record<DialogShape, ShapeStyle> = {
  sheet: {
    overlay: 'fixed inset-0 z-50 bg-black/60 flex items-end justify-center',
    content: 'w-full max-w-lg max-h-[90dvh] bg-white rounded-t-3xl shadow-xl',
    column: '',
    closeWith: 'handle',
  },
  fullscreen: {
    overlay: 'fixed inset-0 z-50',
    content: 'h-full w-full bg-white',
    column: 'mx-auto w-full max-w-2xl',
    closeWith: 'button',
  },
  drawer: {
    overlay: 'fixed inset-0 z-50 bg-black/60 flex justify-end',
    content: 'h-full w-72 max-w-[85%] bg-white shadow-xl',
    column: '',
    closeWith: 'button',
  },
}

function DialogHeader({
  title,
  description,
  onClose,
  column,
}: {
  title: string
  description?: string
  onClose?: () => void
  column: string
}) {
  return (
    <div className="px-5 py-3 border-b border-lob-line flex-shrink-0">
      <div className={`${column} flex items-center justify-between gap-4`}>
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
    </div>
  )
}

/**
 * The Radix Dialog every shape builds on. On open, focus moves to the child marked
 * `data-autofocus`, or else the dialog itself. Tab stays inside, the page behind is hidden from
 * assistive tech and doesn't scroll, and focus returns to the opener on close. A dialog opened
 * from inside another takes Escape and outside taps alone. Build dialogs with `Modal`,
 * `FullScreenDialog` or `Drawer`: the last two need a `title`, whose header holds their X.
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
  const style = SHAPES[shape]
  const inColumn = (node: React.ReactNode) =>
    style.column ? <div className={style.column}>{node}</div> : node

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

  // A tap on a toast (its dismiss X) isn't a tap on the page behind.
  const handleInteractOutside = (e: Event) => {
    if (!dismissible || isToast({ target: e.target })) e.preventDefault()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={style.overlay}
          // A tap on the backdrop would otherwise drop focus to the page behind.
          onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
        >
          <Dialog.Content
            key={focusKey}
            role={role}
            {...(title ? {} : { 'aria-labelledby': labelId })}
            {...(description ? {} : { 'aria-describedby': descriptionId })}
            className={`${style.content} flex flex-col outline-none`}
            onOpenAutoFocus={focusFirst}
            onCloseAutoFocus={returnFocus}
            onEscapeKeyDown={handleEscape}
            onInteractOutside={handleInteractOutside}
            // The dialog is portaled, but React events still bubble to whatever renders it.
            onClick={(e) => e.stopPropagation()}
            {...drag}
          >
            {style.closeWith === 'handle' &&
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
                onClose={style.closeWith === 'button' ? onClose : undefined}
                column={style.column}
              />
            )}
            <div ref={bodyRef} className="px-5 py-4 flex-1 overflow-y-auto">
              {inColumn(children)}
            </div>
            {footer && (
              <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-lob-line flex-shrink-0">
                {inColumn(footer)}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
