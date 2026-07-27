// Module-level pub/sub so non-React code (queryClient.ts) can raise a toast
// without importing React. ToastProvider subscribes on mount and unsubscribes
// on unmount; anything emitted with no subscriber is dropped, which is fine —
// there is no route in this app that renders without ToastProvider mounted.
import { createContext, useContext } from 'react'

export type ToastVariant = 'error' | 'success'

export interface ToastEvent {
  variant: ToastVariant
  message: string
}

type Listener = (event: ToastEvent) => void

const listeners = new Set<Listener>()

export function emitToast(event: ToastEvent): void {
  listeners.forEach((listener) => listener(event))
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// React-facing half of the toast API. Kept in this plain .ts module (rather
// than Toast.tsx) so that file only exports components, per
// react-refresh/only-export-components.
export interface ToastContextValue {
  showToast: (event: ToastEvent) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
