import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AppContextValue {
  loading: boolean
  session: Session | null
  sessionSettled: boolean
  role: string
  loginWithPin: (pin: string) => Promise<{ success: boolean; role: string; error: unknown }>
  logout: () => Promise<void>
  fetchMyProfile: () => Promise<unknown>
  selfSignup: (data: unknown) => Promise<unknown>
  sendMagicLink: (email: string) => Promise<unknown>
  requestMyEmailChange: (email: string) => Promise<unknown>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
