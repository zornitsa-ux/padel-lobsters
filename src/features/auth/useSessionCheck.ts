import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { fetchMyProfile } from '../../api/auth'
import { evaluateSession, type SessionCheckResult } from './sessionCheck'

export type SessionCheckState = { status: 'pending' } | SessionCheckResult

const refresh = async () => (await supabase.auth.refreshSession()).data.session

async function ownPlayerExists(): Promise<boolean | null> {
  try {
    return (await fetchMyProfile()) !== null
  } catch {
    return null
  }
}

// Runs once per signed-in user (token refreshes don't re-run it), after the session settles.
export function useSessionCheck({
  session,
  sessionSettled,
}: {
  session: Session | null
  sessionSettled: boolean
}): SessionCheckState {
  const userId = session?.user?.id ?? null
  const [done, setDone] = useState<{ userId: string; result: SessionCheckResult } | null>(null)

  useEffect(() => {
    if (!sessionSettled || !session || !userId) return
    let cancelled = false
    void evaluateSession({ session, refresh, ownPlayerExists }).then((result) => {
      if (result.status === 'incomplete') {
        console.error('[auth] incomplete session', { reason: result.reason })
      }
      if (!cancelled) setDone({ userId, result })
    })
    return () => {
      cancelled = true
    }
    // The session object changes on every token refresh; the check keys on the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSettled, userId])

  if (!sessionSettled) return { status: 'pending' }
  if (!userId) return { status: 'complete' }
  return done?.userId === userId ? done.result : { status: 'pending' }
}
