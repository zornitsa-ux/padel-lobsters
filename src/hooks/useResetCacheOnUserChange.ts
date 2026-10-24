import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Cached queries belong to whoever was signed in when they ran (my profile, my
// invites, my transfers), and most keys don't name the user. When the account
// changes without a reload, reset the cache so the next account never sees the
// previous one's data.
export function useResetCacheOnUserChange({
  userId,
  settled,
}: {
  userId: string | null
  settled: boolean
}) {
  const queryClient = useQueryClient()
  const previous = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!settled) return
    if (previous.current !== undefined && previous.current !== userId) {
      void queryClient.resetQueries()
    }
    previous.current = userId
  }, [userId, settled, queryClient])
}
