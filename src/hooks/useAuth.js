import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import * as authApi from '../api/auth'

export default function useAuth() {
  const [session, setSession] = useState(null)
  const roleRef = useRef('guest')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  const role = session?.user?.app_metadata?.role ?? 'guest'

  useEffect(() => {
    roleRef.current = role
  }, [role])

  const loginWithPin = useCallback(async (enteredPin) => {
    const result = await authApi.loginWithPin(enteredPin)
    if (result.success && result.session) {
      setSession(result.session)
    }
    return { success: result.success, role: result.role, error: result.error }
  }, [])

  const fetchMyProfile = useCallback(async () => {
    if (!session?.user) return null
    return authApi.fetchMyProfile()
  }, [session])

  const forgotMyPin = useCallback(async (email) => {
    return authApi.forgotMyPin(email)
  }, [])

  const selfSignup = useCallback(async (data) => {
    return authApi.selfSignup(data)
  }, [])

  const fetchAllPlayersWithPii = useCallback(async () => {
    return authApi.fetchAllPlayersWithPii()
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setSession(null)
  }, [])

  return {
    session,
    role,
    roleRef,
    loginWithPin,
    logout,
    fetchMyProfile,
    forgotMyPin,
    selfSignup,
    fetchAllPlayersWithPii,
  }
}
