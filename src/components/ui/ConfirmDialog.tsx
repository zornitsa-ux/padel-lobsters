import { useCallback, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { ConfirmContext, type ConfirmOptions } from '../../lib/confirmBus'
import { ActionRow } from './ActionRow'
import { Button } from './Button'

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  // Guards against Modal's onClose firing after we've already resolved via
  // the Confirm/Cancel buttons — resolving a settled promise a second time
  // is harmless, but calling resolve twice from two different paths is a
  // sign something is wrong, so we only ever let one path fire.
  const settledRef = useRef(false)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      settledRef.current = false
      setPending({ ...options, resolve })
    })
  }, [])

  const settle = useCallback((value: boolean) => {
    if (settledRef.current) return
    settledRef.current = true
    setPending((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const value = useMemo(() => confirm, [confirm])

  // Enter confirms by default; a destructive flow starts on Cancel so Enter can't delete.
  const footer = pending && (
    <ActionRow>
      <Button onClick={() => settle(false)} variant="secondary" autoFocus={pending.destructive}>
        {pending.cancelLabel || 'Cancel'}
      </Button>
      <Button
        onClick={() => settle(true)}
        variant={pending.destructive ? 'danger' : 'primary'}
        autoFocus={!pending.destructive}
      >
        {pending.confirmLabel || 'Confirm'}
      </Button>
    </ActionRow>
  )

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        role="alertdialog"
        title={pending?.title}
        footer={footer}
      >
        <p className="text-sm text-lob-dark">{pending?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}
