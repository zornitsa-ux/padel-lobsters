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
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      // Magic-link / OAuth sessions arrive without a device_id baked
      // into app_metadata (verify-pin sets that for the PIN flow). When
      // we see a fresh sign-in that's missing it, register this device
      // and refresh so the JWT picks up the new claim.
      if (event === 'SIGNED_IN' && s && !s.user?.app_metadata?.device_id) {
        try {
          await authApi.bootstrapDeviceSession()
        } catch (e) {
          console.warn('bootstrapDeviceSession failed', e)
        }
      }
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

  const sendMagicLink = useCallback(async (email) => {
    return authApi.sendMagicLink(email)
  }, [])

  const requestMyEmailChange = useCallback(async (email) => {
    return authApi.requestMyEmailChange(email)
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
    sendMagicLink,
    requestMyEmailChange,
    selfSignup,
    fetchAllPlayersWithPii,
  }
}
