import { useCallback, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { ConfirmContext, type ConfirmOptions } from '../../lib/confirmBus'

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

  const footer = pending && (
    <div className="flex gap-2">
      <button type="button" onClick={() => settle(false)} className="btn-secondary flex-1">
        {pending.cancelLabel || 'Cancel'}
      </button>
      <button
        type="button"
        onClick={() => settle(true)}
        className={pending.destructive ? 'btn-danger flex-1' : 'btn-primary flex-1'}
      >
        {pending.confirmLabel || 'Confirm'}
      </button>
    </div>
  )

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title}
        footer={footer}
      >
        <p className="text-sm text-lob-dark">{pending?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}
