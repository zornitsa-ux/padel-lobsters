import { useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, sessionReady } from '../supabase'
import * as authApi from '../api/auth'
import { mark } from '../lib/perfMarks'

export default function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  // Distinguishes "signed out" from "we don't know yet": session is null for
  // both, and callers that gate on the signed-in player need to tell them apart.
  const [sessionSettled, setSessionSettled] = useState(false)
  const roleRef = useRef('guest')

  useEffect(() => {
    // Resolves from the warm-up kicked off at module load (see supabase.js),
    // so this is usually already settled by the time the effect runs.
    sessionReady.then((s) => {
      mark('session')
      setSession(s)
      setSessionSettled(true)
    })
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

  const loginWithPin = useCallback(async (enteredPin: string) => {
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

  const sendMagicLink = useCallback(async (email: string) => {
    return authApi.sendMagicLink(email)
  }, [])

  const requestMyEmailChange = useCallback(async (email: string) => {
    return authApi.requestMyEmailChange(email)
  }, [])

  const selfSignup = useCallback(async (data: unknown) => {
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
    sessionSettled,
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
