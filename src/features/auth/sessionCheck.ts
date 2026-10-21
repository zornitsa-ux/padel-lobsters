import type { Session } from '@supabase/supabase-js'
import { sessionRole } from './sessionClaims'

export type IncompleteReason = 'no_role' | 'no_player'

export type SessionCheckResult =
  | { status: 'complete' }
  | { status: 'incomplete'; reason: IncompleteReason }

const hasRole = (session: Session | null) => sessionRole({ session }) !== 'guest'

// C-12: complete = a player/admin role claim and the user's own players row. A missing
// claim gets exactly one refresh (the token may predate its players row).
// `ownPlayerExists` resolves null when the read itself failed: that never blocks sign-in.
export async function evaluateSession({
  session,
  refresh,
  ownPlayerExists,
}: {
  session: Session
  refresh: () => Promise<Session | null>
  ownPlayerExists: () => Promise<boolean | null>
}): Promise<SessionCheckResult> {
  if (!hasRole(session) && !hasRole(await refresh())) {
    return { status: 'incomplete', reason: 'no_role' }
  }
  return (await ownPlayerExists()) === false
    ? { status: 'incomplete', reason: 'no_player' }
    : { status: 'complete' }
}
