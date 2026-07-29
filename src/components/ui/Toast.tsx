import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertBox } from './AlertBox'
import {
  ToastContext,
  subscribeToast,
  type ToastEvent,
  type ToastVariant,
} from '../../lib/toastBus'

interface Toast extends ToastEvent {
  id: number
}

// Errors need to stay put until the user has actually read them — a payment
// or save failure shouldn't vanish before they've noticed it. Success is
// low-stakes confirmation, so it clears itself quickly to stay out of the way.
const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  error: null,
  success: 3000,
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(({ variant, message }: ToastEvent) => {
    const id = nextId++
    setToasts((current) => [...current, { id, variant, message }])
  }, [])

  useEffect(() => subscribeToast(showToast), [showToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      className="fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { id, variant, message } = toast
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const duration = AUTO_DISMISS_MS[variant]
    if (duration === null) return
    const timer = setTimeout(() => onDismissRef.current(id), duration)
    return () => clearTimeout(timer)
  }, [id, variant])

  return (
    <div
      role="status"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className="w-full max-w-md pointer-events-auto shadow-lg"
    >
      <AlertBox variant={variant} onDismiss={() => onDismiss(id)}>
        {message}
      </AlertBox>
    </div>
  )
}
