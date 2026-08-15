import { useCallback, useEffect, useState } from 'react'
import { usePlayerPii, useEnsurePlayerPii, useForgetPlayerPii } from '../players/usePlayers'
import type { PlayerPii } from '../players/playerQueries'

// Shared state machine behind every "reveal this player's contact details"
// control (PlayerProfileDrawer, PendingApprovalsList, LinkPlayerModal).
// Nothing is fetched until `reveal()` is called — mounting a component that
// uses this hook costs zero PII reads. Each surface owns its own markup
// (a block, an inline chip, a per-row icon) since the three look nothing
// alike; this only owns revealed/loading/error/hide.
export function useRevealPii(playerId: string) {
  const [revealed, setRevealed] = useState(false)
  const forget = useForgetPlayerPii()
  const { data, isLoading, isError, refetch } = usePlayerPii({
    id: playerId,
    enabled: revealed,
  })

  const reveal = useCallback(() => setRevealed(true), [])
  const hide = useCallback(() => {
    setRevealed(false)
    forget(playerId)
  }, [forget, playerId])

  // Purge on unmount too — a drawer that closes (rather than being
  // explicitly hidden first) shouldn't leave this player's PII cached.
  // onlyIfUnobserved: a sibling surface (e.g. the pending-approvals row
  // behind a closing LinkPlayerModal) may still be observing this same
  // player's PII — unmounting here must not blank it out from under them.
  useEffect(() => () => forget(playerId, { onlyIfUnobserved: true }), [playerId, forget])

  return {
    revealed,
    reveal,
    hide,
    retry: refetch,
    pii: data as PlayerPii | undefined,
    isLoading,
    isError,
  }
}

// Non-visual variant for a write path that needs one player's PII resolved
// before it can proceed (e.g. a merge/link confirm needs BOTH sides' data
// at once, which doesn't fit the single-boolean reveal/hide shape above).
// Throws on failure — callers must not treat a rejected promise as blanks.
export function useResolvePlayerPii() {
  const ensure = useEnsurePlayerPii()
  return useCallback((id: string) => ensure(id), [ensure])
}
