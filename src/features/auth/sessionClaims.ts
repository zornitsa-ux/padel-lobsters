import type { Session } from '@supabase/supabase-js'

interface AmrEntry {
  method?: string
}

interface AccessTokenClaims {
  amr?: AmrEntry[]
  app_metadata?: { role?: string }
}

export type AppRole = 'admin' | 'player' | 'guest'

function decodePayload({ token }: { token: string }): AccessTokenClaims | null {
  try {
    const body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}

// C-12: the role is the token's own claim, stamped from players.role by
// custom_access_token_hook. Decoded locally: display only, the server enforces.
export function sessionRole({ session }: { session: Session | null }): AppRole {
  if (!session) return 'guest'
  const role = decodePayload({ token: session.access_token })?.app_metadata?.role
  return role === 'admin' || role === 'player' ? role : 'guest'
}

export function sessionUsedPassword({ session }: { session: Session | null }): boolean {
  if (!session) return false
  const amr = decodePayload({ token: session.access_token })?.amr
  return Array.isArray(amr) && amr.some((entry) => entry?.method === 'password')
}
