import { useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, getSessionReady } from '../supabase'
import * as authApi from '../api/auth'
import { mark } from '../lib/perfMarks'
import { sessionRole } from '../features/auth/sessionClaims'

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
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // C-12: the role is the token's own claim, never a second copy in app_metadata.
  const role = sessionRole({ session })
  const isAdmin = role === 'admin'

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

  const requestMyEmailChange = useCallback(async (email: string) => {
    return authApi.requestMyEmailChange(email)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setSession(null)
  }, [])

  return {
    session,
    sessionSettled,
    role,
    isAdmin,
    roleRef,
    loginWithPin,
    logout,
    fetchMyProfile,
    requestMyEmailChange,
  }
}
