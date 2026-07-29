// React-facing API for the confirm dialog, mirroring toastBus.ts. Kept in a
// plain .ts module (rather than ConfirmDialog.tsx) so that file only exports
// components, per react-refresh/only-export-components.
import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}
