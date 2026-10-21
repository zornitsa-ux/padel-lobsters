import type { AuthError, EmailOtpType, Session } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { saveReturnPath } from './returnPath'

export interface AuthResult {
  error: AuthError | null
}

export interface SessionResult extends AuthResult {
  session: Session | null
}

export const normaliseEmail = (email: string | null | undefined): string =>
  String(email ?? '')
    .trim()
    .toLowerCase()

export const looksLikeEmail = (email: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)

const confirmUrl = (query = '') => `${window.location.origin}/auth/confirm${query}`

export async function requestEmailCode({
  email,
  shouldCreateUser = false,
  data,
}: {
  email: string
  shouldCreateUser?: boolean
  data?: Record<string, string>
}): Promise<AuthResult> {
  saveReturnPath()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser, data, emailRedirectTo: confirmUrl('?next=/home') },
  })
  return { error }
}

export async function verifyEmailCode({
  email,
  token,
  type = 'email',
}: {
  email: string
  token: string
  type?: EmailOtpType
}): Promise<SessionResult> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type })
  return { session: data.session, error }
}

export async function signInWithPassword({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<SessionResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { session: data.session, error }
}

export async function sendPasswordReset({ email }: { email: string }): Promise<AuthResult> {
  saveReturnPath()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl('?type=recovery'),
  })
  return { error }
}

export async function setPassword({
  password,
  currentPassword,
  nonce,
}: {
  password: string
  currentPassword?: string
  nonce?: string
}): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({
    password,
    ...(currentPassword ? { current_password: currentPassword } : {}),
    ...(nonce ? { nonce } : {}),
  })
  return { error }
}

export async function requestReauthentication(): Promise<AuthResult> {
  const { error } = await supabase.auth.reauthenticate()
  return { error }
}

export async function signOutEverywhere(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  return { error }
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}
