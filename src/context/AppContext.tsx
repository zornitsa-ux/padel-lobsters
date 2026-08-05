import React, { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import useAuth from '../hooks/useAuth'
import { playerKeys } from '../features/players/playerKeys'
import { AppContext } from './useApp'

// Auth/session provider
// Domain data lives in per-feature TanStack Query slices (src/features/**);
// this context intentionally remains as the single place the auth session is
// subscribed and shared. `selfSignup` is the one action kept here: it wraps
// useAuth's version to also refresh the roster. Consumers that need to know
// whether auth has resolved read `sessionSettled`.

interface AppProviderProps {
  children: React.ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const auth = useAuth()
  const { session, sessionSettled, role } = auth
  const queryClient = useQueryClient()

  // ── Invalidation helpers ────────────────────────────────────
  const invalidatePlayers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: playerKeys.all() }),
    [queryClient],
  )

  // selfSignup: extends useAuth's version to also refresh the players list
  // so the new row is visible immediately after a successful signup.
  const selfSignup = useCallback(
    async (data: unknown) => {
      const result = await auth.selfSignup(data)
      if (!result.error && result.data) {
        await invalidatePlayers()
      }
      return result
    },
    [auth, invalidatePlayers],
  )

  return (
    <AppContext.Provider
      value={{
        session,
        sessionSettled,
        role,
        loginWithPin: auth.loginWithPin,
        logout: auth.logout,
        fetchMyProfile: auth.fetchMyProfile,
        selfSignup,
        sendMagicLink: auth.sendMagicLink,
        requestMyEmailChange: auth.requestMyEmailChange,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
