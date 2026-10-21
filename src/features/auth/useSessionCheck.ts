import { useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { fetchMyProfile } from '../players/playerQueries'
import { playerKeys } from '../players/playerKeys'
import { evaluateSession, type SessionCheckResult } from './sessionCheck'

export type SessionCheckState = { status: 'pending' } | SessionCheckResult

// null: the refresh failed, which is not evidence about the account.
async function refresh(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession()
  return error ? null : data.session
}

// Shares the cache with Settings' own-profile read. null: the read failed.
async function ownPlayerExists({ queryClient }: { queryClient: QueryClient }) {
  try {
    const profile = await queryClient.fetchQuery({
      queryKey: playerKeys.me(),
      queryFn: fetchMyProfile,
    })
    return profile !== null
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
  const queryClient = useQueryClient()
  const userId = session?.user?.id ?? null
  const [done, setDone] = useState<{ userId: string; result: SessionCheckResult } | null>(null)

  useEffect(() => {
    if (!sessionSettled) return
    if (!session || !userId) {
      setDone(null)
      return
    }
    let cancelled = false
    evaluateSession({ session, refresh, ownPlayerExists: () => ownPlayerExists({ queryClient }) })
      .catch((error): SessionCheckResult => {
        console.warn('[auth] session check failed', error)
        return { status: 'complete' }
      })
      .then((result) => {
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
