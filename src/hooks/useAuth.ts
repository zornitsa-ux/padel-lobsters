import { useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, getSessionReady } from '../supabase'
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
    getSessionReady().then((s) => {
      mark('session')
      setSession(s)
      setSessionSettled(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      // Magic-link / OAuth sessions arrive before the player's role is in
      // app_metadata (verify-pin sets it for the PIN flow). Sync and refresh
      // so the client stops treating them as a guest.
      if (event === 'SIGNED_IN' && s && !s.user?.app_metadata?.role) {
        try {
          await authApi.syncMyRole()
        } catch (e) {
          console.warn('syncMyRole failed', e)
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
    return { success: result.success, role: result.role ?? 'guest', error: result.error }
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
    return authApi.selfSignup(data as authApi.SelfSignupInput)
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
  }
}
