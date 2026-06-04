import { useEffect, useRef } from 'react'

// Freshness primitive for surfaces that have dropped realtime/polling in favour
// of flat reads (see the tournament data-access refactor). Runs `callback` when
// the tab/app regains focus or becomes visible again, throttled so a quick
// blur/focus flicker can't trigger a burst of refetches.
//
// TanStack-Query surfaces already get this via `refetchOnWindowFocus` in
// src/lib/queryClient.ts — use this hook for the context/local-state slices that
// don't go through the query cache.
export default function useRefreshOnFocus(callback, { throttleMs = 10_000 } = {}) {
  const cbRef = useRef(callback)
  cbRef.current = callback
  const lastRunRef = useRef(0)

  useEffect(() => {
    const maybeRun = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastRunRef.current < throttleMs) return
      lastRunRef.current = now
      cbRef.current?.()
    }
    window.addEventListener('focus', maybeRun)
    document.addEventListener('visibilitychange', maybeRun)
    return () => {
      window.removeEventListener('focus', maybeRun)
      document.removeEventListener('visibilitychange', maybeRun)
    }
  }, [throttleMs])
}
