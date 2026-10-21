import React from 'react'
import useAuth from '../hooks/useAuth'
import { AppContext } from './useApp'

// Auth/session provider
// Domain data lives in per-feature TanStack Query slices (src/features/**);
// this context intentionally remains as the single place the auth session is
// subscribed and shared. Consumers that need to know whether auth has resolved
// read `sessionSettled`.

interface AppProviderProps {
  children: React.ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const auth = useAuth()

  return (
    <AppContext.Provider
      value={{
        session: auth.session,
        sessionSettled: auth.sessionSettled,
        role: auth.role,
        isAdmin: auth.isAdmin,
        loginWithPin: auth.loginWithPin,
        logout: auth.logout,
        fetchMyProfile: auth.fetchMyProfile,
        requestMyEmailChange: auth.requestMyEmailChange,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
