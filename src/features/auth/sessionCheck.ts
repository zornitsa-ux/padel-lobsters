import type { Session } from '@supabase/supabase-js'
import { sessionRole } from './sessionClaims'

export type IncompleteReason = 'no_role' | 'no_player'

export type SessionCheckResult =
  | { status: 'complete' }
  | { status: 'incomplete'; reason: IncompleteReason }

const hasRole = (session: Session | null) => sessionRole({ session }) !== 'guest'

// C-12: complete = a player/admin role claim and the user's own players row. A missing
// claim gets exactly one refresh (the token may predate its players row).
// A failed refresh (null) or players read (null) never blocks sign-in: only a successful
// refresh whose token still lacks the role is no_role.
export async function evaluateSession({
  session,
  refresh,
  ownPlayerExists,
}: {
  session: Session
  refresh: () => Promise<Session | null>
  ownPlayerExists: () => Promise<boolean | null>
}): Promise<SessionCheckResult> {
  if (!hasRole(session)) {
    const refreshed = await refresh()
    if (!refreshed) return { status: 'complete' }
    if (!hasRole(refreshed)) return { status: 'incomplete', reason: 'no_role' }
  }
  return (await ownPlayerExists()) === false
    ? { status: 'incomplete', reason: 'no_player' }
    : { status: 'complete' }
}
