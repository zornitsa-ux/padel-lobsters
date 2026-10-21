import type { Session } from '@supabase/supabase-js'

interface AmrEntry {
  method?: string
}

function decodePayload({ token }: { token: string }): { amr?: AmrEntry[] } | null {
  try {
    const body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}

export function sessionUsedPassword({ session }: { session: Session | null }): boolean {
  if (!session) return false
  const amr = decodePayload({ token: session.access_token })?.amr
  return Array.isArray(amr) && amr.some((entry) => entry?.method === 'password')
}
